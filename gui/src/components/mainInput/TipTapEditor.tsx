import Document from "@tiptap/extension-document";
import History from "@tiptap/extension-history";
import Image from "@tiptap/extension-image";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Text from "@tiptap/extension-text";
import { Plugin } from "@tiptap/pm/state";
import { Editor, EditorContent, JSONContent, useEditor } from "@tiptap/react";
import {
  ContextItemWithId,
  ContextProviderDescription,
  InputModifiers,
  RangeInFile,
} from "core";
import { modelSupportsImages } from "core/llm/autodetect";
import { getBasename, getRelativePath, isValidFilePath } from "core/util";
import { usePostHog } from "posthog-js/react";
import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscBadgeBackground,
  vscForeground,
  vscInputBackground,
  vscInputBorderFocus,
} from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { SubmenuContextProvidersContext } from "../../context/SubmenuContextProviders";
import useHistory from "../../hooks/useHistory";
import { useInputHistory } from "../../hooks/useInputHistory";
import useUpdatingRef from "../../hooks/useUpdatingRef";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { selectUseActiveFile } from "../../redux/selectors";
import { defaultModelSelector } from "../../redux/selectors/modelSelectors";
import {
  consumeMainEditorContent,
  newSession,
  setContextItems,
  setEditingContextItemAtIndex,
} from "../../redux/slices/stateSlice";
import { RootState } from "../../redux/store";
import {
  getFontSize,
  isJetBrains,
  isMetaEquivalentKeyPressed,
  isWebEnvironment
} from "../../util";
import CodeBlockExtension from "./CodeBlockExtension";
import { SlashCommand } from "./CommandsExtension";
import InputToolbar from "./InputToolbar";
import { Mention } from "./MentionExtension";
import "./TipTapEditor.css";
import {
  getContextProviderDropdownOptions,
  getSlashCommandDropdownOptions,
} from "./getSuggestion";
import { ComboBoxItem } from "./types";
import { useLocation } from "react-router-dom";

const InputBoxDiv = styled.div`
  resize: none;
  padding: 8px 12px;
  padding-bottom: 4px;
  font-family: inherit;
  border-radius: ${defaultBorderRadius};
  margin: 0;
  height: auto;
  width: calc(100% - 18px);
  background-color: ${vscInputBackground};
  color: ${vscForeground};
  z-index: 1;
  outline: none;
  font-size: ${getFontSize()}px;

  &:focus {
    outline: none;
    border: 0.5px solid ${vscInputBorderFocus};
  }

  &::placeholder {
    color: ${lightGray}cc;
  }

  display: flex;
  flex-direction: column;
`;

const HoverDiv = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  opacity: 0.5;
  background-color: ${vscBadgeBackground};
  color: ${vscForeground};
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const HoverTextDiv = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  color: ${vscForeground};
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
`;


const getPlaceholder = (historyLength: number, location: any) => {
  if (location?.pathname === "/aiderMode" || location?.pathname === "/inventory/aiderMode") {
    return historyLength === 0
      ? "Ask me to create, change, or fix anything..."
      : "Send a follow-up";
  }
  else if (location?.pathname === "/perplexityMode" || location?.pathname === "/inventory/perplexityMode") {
    return historyLength === 0 ? "Ask for any information" : "Ask a follow-up";
  }

  return historyLength === 0
    ? "Ask anything, '/' for slash commands, '@' to add context"
    : "Ask a follow-up";
};

function getDataUrlForFile(file: File, img): string {
  const targetWidth = 512;
  const targetHeight = 512;
  const scaleFactor = Math.min(
    targetWidth / img.width,
    targetHeight / img.height,
  );

  const canvas = document.createElement("canvas");
  canvas.width = img.width * scaleFactor;
  canvas.height = img.height * scaleFactor;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const downsizedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
  return downsizedDataUrl;
}

interface ShowFileEvent extends CustomEvent<{ filepath: string }> {}

interface TipTapEditorProps {
  availableContextProviders: ContextProviderDescription[];
  availableSlashCommands: ComboBoxItem[];
  isMainInput: boolean;
  onEnter: (editorState: JSONContent, modifiers: InputModifiers) => void;
  editorState?: JSONContent;
  source?: 'perplexity' | 'aider' | 'continue';
  onContentChange?: (newState: JSONContent) => void;
}
const TipTapEditor = memo(function TipTapEditor({
  availableContextProviders,
  availableSlashCommands,
  isMainInput,
  onEnter,
  editorState,
  source = 'continue',
  onContentChange,
}: TipTapEditorProps) {
  const dispatch = useDispatch();

  const ideMessenger = useContext(IdeMessengerContext);
  const { getSubmenuContextItems } = useContext(SubmenuContextProvidersContext);

  const historyLength = useSelector(
    (store: RootState) => {
      switch(source) {
        case 'perplexity':
          return store.state.perplexityHistory.length;
        case 'aider':
          return store.state.aiderHistory.length;
        default:
          return store.state.history.length;
      }
    }
  );

  const useActiveFile = useSelector(selectUseActiveFile);

  const { saveSession } = useHistory(dispatch, source);

  const posthog = usePostHog();

  const inSubmenuRef = useRef<string | undefined>(undefined);
  const inDropdownRef = useRef(false);

  const enterSubmenu = async (editor: Editor, providerId: string) => {
    const contents = editor.getText();
    const indexOfAt = contents.lastIndexOf("@");
    if (indexOfAt === -1) {
      return;
    }

    editor.commands.deleteRange({
      from: indexOfAt + 2,
      to: contents.length + 1,
    });
    inSubmenuRef.current = providerId;

    // to trigger refresh of suggestions
    editor.commands.insertContent(" ");
    editor.commands.deleteRange({
      from: editor.state.selection.anchor - 1,
      to: editor.state.selection.anchor,
    });
  };

  const onClose = () => {
    inSubmenuRef.current = undefined;
    inDropdownRef.current = false;
  };

  const onOpen = () => {
    inDropdownRef.current = true;
  };

  const contextItems = useSelector(
    (store: RootState) => store.state.contextItems,
  );
  const defaultModel = useSelector(defaultModelSelector);
  const getSubmenuContextItemsRef = useUpdatingRef(getSubmenuContextItems);
  const availableContextProvidersRef = useUpdatingRef(availableContextProviders)

  const historyLengthRef = useUpdatingRef(historyLength);
  const availableSlashCommandsRef = useUpdatingRef(
    availableSlashCommands,
  );

  const active = useSelector((store: RootState) => {
    switch(source) {
      case 'perplexity':
        return store.state.perplexityActive;
      case 'aider':
        return store.state.aiderActive;
      default:
        return store.state.active;
    }
  });

  const activeRef = useUpdatingRef(active);

  async function handleImageFile(
    file: File,
  ): Promise<[HTMLImageElement, string] | undefined> {
    const filesize = file.size / 1024 / 1024; // filesize in MB
    // check image type and size
    if (
      [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/svg",
        "image/webp",
      ].includes(file.type) &&
      filesize < 10
    ) {
      // check dimensions
      const _URL = window.URL || window.webkitURL;
      const img = new window.Image();
      img.src = _URL.createObjectURL(file);

      return await new Promise((resolve) => {
        img.onload = function () {
          const dataUrl = getDataUrlForFile(file, img);

          const image = new window.Image();
          image.src = dataUrl;
          image.onload = function () {
            resolve([image, dataUrl]);
          };
        };
      });
    } else {
      ideMessenger.post("errorPopup", {
        message:
          "Images need to be in jpg or png format and less than 10MB in size.",
      });
    }
    return undefined;
  }

  const mainEditorContent = useSelector(
    (store: RootState) => store.state.mainEditorContent,
  );

  const { prevRef, nextRef, addRef } = useInputHistory();
  const location = useLocation();

  // Keep track of the last valid content
  const lastContentRef = useRef(editorState);

  useEffect(() => {
    if (editorState) {
      lastContentRef.current = editorState;
    }
  }, [editorState]);

  const editor: Editor = useEditor({
    extensions: [
      Document,
      History,
      Image.extend({
        addProseMirrorPlugins() {
          const plugin = new Plugin({
            props: {
              handleDOMEvents: {
                paste(view, event) {
                  console.log("Pasting image");
                  const items = event.clipboardData.items;
                  for (const item of items) {
                    const file = item.getAsFile();
                    file &&
                      modelSupportsImages(
                        defaultModel.provider,
                        defaultModel.model,
                        defaultModel.title,
                        defaultModel.capabilities,
                      ) &&
                      handleImageFile(file).then((resp) => {
                        if (!resp) {
                          return;
                        }
                        const [img, dataUrl] = resp;
                        const { schema } = view.state;
                        const node = schema.nodes.image.create({
                          src: dataUrl,
                        });
                        const tr = view.state.tr.insert(0, node);
                        view.dispatch(tr);
                      });
                  }
                },
              },
            },
          });
          return [plugin];
        },
      }),
      Placeholder.configure({
        placeholder: () => getPlaceholder(historyLengthRef.current, location),
      }),
      Paragraph.extend({
        addKeyboardShortcuts() {
          return {
            Enter: () => {
              if (inDropdownRef.current) {
                return false;
              }

              onEnterRef.current({
                useCodebase: false,
                noContext: !useActiveFile,
              });
              return true;
            },

            "Mod-Enter": () => {
              onEnterRef.current({
                useCodebase: true,
                noContext: !useActiveFile,
              });
              return true;
            },
            "Alt-Enter": () => {
              posthog.capture("gui_use_active_file_enter");

              onEnterRef.current({
                useCodebase: false,
                noContext: useActiveFile,
              });

              return true;
            },
            "Mod-Backspace": () => {
              // If you press cmd+backspace wanting to cancel,
              // but are inside of a text box, it shouldn't
              // delete the text
              if (activeRef.current) {
                return true;
              }
            },
            "Shift-Enter": () =>
              this.editor.commands.first(({ commands }) => [
                () => commands.newlineInCode(),
                () => commands.createParagraphNear(),
                () => commands.liftEmptyBlock(),
                () => commands.splitBlock(),
              ]),

            ArrowUp: () => {
              if (this.editor.state.selection.anchor > 1) {
                return false;
              }

              const previousInput = prevRef.current(
                this.editor.state.toJSON().doc,
              );
              if (previousInput) {
                this.editor.commands.setContent(previousInput);
                setTimeout(() => {
                  this.editor.commands.blur();
                  this.editor.commands.focus("start");
                }, 0);
                return true;
              }
            },
            ArrowDown: () => {
              if (
                this.editor.state.selection.anchor <
                this.editor.state.doc.content.size - 1
              ) {
                return false;
              }
              const nextInput = nextRef.current();
              if (nextInput) {
                this.editor.commands.setContent(nextInput);
                setTimeout(() => {
                  this.editor.commands.blur();
                  this.editor.commands.focus("end");
                }, 0);
                return true;
              }
            },
          };
        },
      }).configure({
        HTMLAttributes: {
          class: "my-1",
        },
      }),
      Text,
      Mention.configure({
        HTMLAttributes: {
          class: "mention",
        },
        suggestion: getContextProviderDropdownOptions(
          availableContextProvidersRef,
          getSubmenuContextItemsRef,
          enterSubmenu,
          onClose,
          onOpen,
          inSubmenuRef,
          ideMessenger,
        ),
        renderHTML: (props) => {
          return `@${props.node.attrs.label || props.node.attrs.id} `;
        },
      }),
      SlashCommand.configure({
        HTMLAttributes: {
          class: "mention",
        },
        suggestion: getSlashCommandDropdownOptions(
          availableSlashCommandsRef,
          onClose,
          onOpen,
          ideMessenger,
        ),
        renderText: (props) => {
          return props.node.attrs.label;
        },
      }),
      CodeBlockExtension,
    ],
    editorProps: {
      attributes: {
        class: "outline-none -mt-1 mb-1 overflow-hidden",
        style: `font-size: ${getFontSize()}px;`,
      },
    },
    content: lastContentRef.current,
    editable: true,
    onFocus: () => editorFocusedRef.current = true,
    onBlur: () => editorFocusedRef.current = true,
    onUpdate: ({ editor, transaction }) => {
      if (contextItems.length > 0) {
        return;
      }

      const json = editor.getJSON();
      const codeBlock = json.content?.find((el) => el.type === "codeBlock");

      if (!codeBlock) {
        return;
      }

      // Search for slashcommand type
      for (const p of json.content) {
        if (
          p.type !== "paragraph" ||
          !p.content ||
          typeof p.content === "string"
        ) {
          continue;
        }
        for (const node of p.content) {
          if (
            node.type === "slashcommand" &&
            ["/edit", "/comment"].includes(node.attrs.label)
          ) {
            // Update context items
            dispatch(
              setEditingContextItemAtIndex({ item: codeBlock.attrs.item }),
            );
            return;
          }
        }
      }
    },
    onCreate({ editor }) {
      if (lastContentRef.current) {
        editor.commands.setContent(lastContentRef.current);
      }
    }
  }, [historyLength]);

  const handleShowFile = useCallback((event: ShowFileEvent) => {
    if (!ideMessenger) return;
    
    try {
      const { filepath } = event.detail;
      if (!isValidFilePath(filepath)) {
        console.warn('Invalid file path received:', filepath);
        
        return;
      }
      
      ideMessenger.post("showFile", { filepath });
    } catch (error) {
      console.error('Error handling show file event:', error);
    }
  }, [ideMessenger]);

  const editorFocusedRef = useUpdatingRef(editor?.isFocused, [editor]);

  const isEditorEmpty = useCallback((editor: Editor) => {
    const content = editor.getJSON();
  
    // Counting number of "@" mentions, if more than 1 return false
    // Else, check if there's also text, if so, then is not empty.
    // If only one "@" mention with no text, then switch the mention
    // With new current file's mention.
    const mentionCount = content.content?.reduce((count, node) => {
      return count + (node.content?.filter(child => child.type === "mention").length || 0);
    }, 0) || 0;
  
    if (mentionCount > 1) return false;
  
    return !content.content?.some(node => 
      (node.type === "paragraph" && 
        node.content?.some(child => 
          (child.type === "text" && child.text.trim().length > 0)
        )
      ) ||
      node.type === "slashcommand" ||
      node.type === "codeBlock"
    );
  }, []);

  const createContextItem = useCallback((filepath: string): ContextItemWithId => ({
      name: `@${filepath.split(/[\\/]/).pop()}`,
      description: filepath,
      id: {
        providerTitle: "file",
        itemId: filepath,
      },
      content: "",
      editable: false
  }), []);

  const updateEditorContent = useCallback((editor: Editor, contextItem: ContextItemWithId) => {
    editor.commands.clearContent();
    editor.commands.setContent({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'mention',
          attrs: {
            id: contextItem.id.itemId,
            label: contextItem.name.replace(/^@/, ''),
            renderInlineAs: null,
            query: contextItem.id.itemId,
            itemType: "file"
          }
        },
        {
          type: 'text',
          text: ' '
        }]
      }]
    });
  }, []);

  const createAndSetContext = useCallback(
    async (filepath: string) => {
      if (isValidFilePath(filepath) && editor && isEditorEmpty(editor)) {
        const contextItem = createContextItem(filepath);
        dispatch(setContextItems([contextItem]));
        updateEditorContent(editor, contextItem);
        editor.commands.focus("end");
      }
    },
    [editor, createContextItem, dispatch, updateEditorContent]
  );
  
  useEffect(() => {
    if (isMainInput && editor && historyLength === 0) {
      ideMessenger.ide.getCurrentFile().then(
        filepath => filepath && createAndSetContext(filepath)
      ).catch(console.error);
    }
  }, [editor, isMainInput, historyLength, createAndSetContext]);
  
  const handleEditorChange = useCallback(
    async (data: { filepath: string | null }) => {
      if (isMainInput && historyLength === 0 && data.filepath) {
        await createAndSetContext(data.filepath);
      }
    },
    [isMainInput, historyLength, createAndSetContext]
  );
  
  useWebviewListener(
    "activeEditorChange",
    handleEditorChange,
    [handleEditorChange]
  );

  useEffect(() => {
    if (!ideMessenger) return;
  
    const listener = (event: ShowFileEvent) => {
      try {
        handleShowFile(event);
      } catch (error) {
        console.error('Error in show file handler:', error);
      }
    };
  
    window.addEventListener('showFile', listener as EventListener);
    
    return () => {
      window.removeEventListener('showFile', listener as EventListener);
    };
  }, [handleShowFile, ideMessenger]);

  useEffect(() => {
    if (isJetBrains()) {
      // This is only for VS Code .ipynb files
      return;
    }

    if (isWebEnvironment()) {
      const handleKeyDown = async (event: KeyboardEvent) => {
        if (!editor || !editorFocusedRef.current) {
          return;
        }
        if ((event.metaKey || event.ctrlKey) && event.key === "x") {
          // Cut
          const selectedText = editor.state.doc.textBetween(
            editor.state.selection.from,
            editor.state.selection.to,
          );

          navigator.clipboard.writeText(selectedText);
          editor.commands.deleteSelection();
          event.preventDefault();
        } else if ((event.metaKey || event.ctrlKey) && event.key === "c") {
          // Copy
          const selectedText = editor.state.doc.textBetween(
            editor.state.selection.from,
            editor.state.selection.to,
          );

          navigator.clipboard.writeText(selectedText);
          event.preventDefault();
        } else if ((event.metaKey || event.ctrlKey) && event.key === "v") {
          // Paste
          event.preventDefault(); // Prevent default paste behavior

          const clipboardText = await navigator.clipboard.readText();

          editor.commands.insertContent(clipboardText);
        }
      };

      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }

    const handleKeyDown = async (event: KeyboardEvent) => {
      if (!editor || !editorFocusedRef.current) {
        return;
      }

      if (event.metaKey && event.key === "x") {
        document.execCommand("cut");
        event.stopPropagation();
        event.preventDefault();
      } else if (event.metaKey && event.key === "v") {
        document.execCommand("paste");
        event.stopPropagation();
        event.preventDefault();
      } else if (event.metaKey && event.key === "c") {
        document.execCommand("copy");
        event.stopPropagation();
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, editorFocusedRef]);

  useEffect(() => {
    if (mainEditorContent && editor) {
      editor.commands.setContent(mainEditorContent);
      dispatch(consumeMainEditorContent());
    }
  }, [mainEditorContent, editor]);
  
  const onEnterRef = useUpdatingRef(
    (modifiers: InputModifiers) => {
      const json = editor.getJSON();

      // Don't do anything if input box is empty
      if (!json.content?.some((c) => c.content)) {
        return;
      }
  
      const mentions = json.content?.reduce((acc, node) => {
        if (node.content) {
          const mentionNodes = node.content.filter(child => child.type === "mention");

          acc.push(...mentionNodes);
        }
        return acc;
      }, []);
  
      const newContextItems = mentions.map(mention => ({
        name: mention.attrs.label || mention.attrs.id,
        description: mention.attrs.id,
        id: {
          providerTitle: "file",
          itemId: mention.attrs.id
        },
        content: "",
        editable: false
      }));
  
      requestAnimationFrame(() => {
        dispatch(setContextItems(newContextItems));
        
        if (isMainInput) {
          const content = editor.state.toJSON().doc;

          addRef.current(content);
        }
      });
  
      onEnter(json, modifiers);
    },
    [onEnter, editor, isMainInput]
  );

  // This is a mechanism for overriding the IDE keyboard shortcut when inside of the webview
  const [ignoreHighlightedCode, setIgnoreHighlightedCode] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: any) => {
      if (
        isMetaEquivalentKeyPressed(event) &&
        (isJetBrains() ? event.code === "KeyJ" : event.code === "KeyL")
      ) {
        setIgnoreHighlightedCode(true);
        setTimeout(() => {
          setIgnoreHighlightedCode(false);
        }, 100);
      } else if (event.key === "Escape") {
        ideMessenger.post("focusEditor", undefined);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Re-focus main input after done generating
  useEffect(() => {
    if (editor && !active && isMainInput && document.hasFocus()) {
      editor.commands.focus(undefined, { scrollIntoView: false });
    }
  }, [isMainInput, active, editor]);

  // IDE event listeners
  useWebviewListener(
    "userInput",
    async (data) => {
      if (!isMainInput) {
        return;
      }
      editor?.commands.insertContent(data.input);
      onEnterRef.current({ useCodebase: false, noContext: true });
    },
    [editor, onEnterRef.current, isMainInput],
  );

  useWebviewListener(
    "addPerplexityContextinChat",
    async (data) => {
      if (!isMainInput || !editor) {
        return;
      }

      const item: ContextItemWithId = {
        content: data.text,
        name: "Context from PearAI Search",
        description: "Context from result of Perplexity AI",
        id: {
          providerTitle: "code",
          itemId: data.text,
        },
        language: data.language,
      };

      let index = 0;
      for (const el of editor.getJSON().content) {
        if (el.type === "codeBlock") {
          index += 2;
        } else {
          break;
        }
      }
      editor
        .chain()
        .insertContentAt(index, {
          type: "codeBlock",
          attrs: {
            item,
          },
        })
        .run();

      setTimeout(() => {
          editor.commands.blur();
          editor.commands.focus("end");
      }, 20);
    },
    [editor, onEnterRef.current, isMainInput],
  );

  useWebviewListener("jetbrains/editorInsetRefresh", async () => {
    editor?.chain().clearContent().focus().run();
  });

  useWebviewListener(
    "focusContinueInput",
    async (data) => {
      if (!isMainInput) {
        return;
      }
      if (historyLength > 0) {
        saveSession();
      }
      setTimeout(() => {
        editor?.commands.blur();
        editor?.commands.focus("end");
      }, 20);
    },
    [historyLength, saveSession, editor, isMainInput],
  );

  useWebviewListener(
    "focusContinueInputWithoutClear",
    async () => {
      if (!isMainInput) {
        return;
      }
      setTimeout(() => {
        editor?.commands.focus("end");
      }, 20);
    },
    [editor, isMainInput],
  );

  useWebviewListener(
    "focusContinueInputWithNewSession",
    async () => {
      if (!isMainInput) {
        return;
      }
      saveSession();
      setTimeout(() => {
        editor?.commands.focus("end");
      }, 20);
    },
    [editor, isMainInput],
  );

  useWebviewListener(
    "highlightedCode",
    async (data) => {
      if (!isMainInput || !editor) {
        return;
      }
      if (!ignoreHighlightedCode) {
        const rif: RangeInFile & { contents: string } =
          data.rangeInFileWithContents;
        const basename = getBasename(rif.filepath);
        const relativePath = getRelativePath(
          rif.filepath,
          await ideMessenger.ide.getWorkspaceDirs(),
        );
        const rangeStr = `(${rif.range.start.line + 1}-${
          rif.range.end.line + 1
        })`;
        const item: ContextItemWithId = {
          content: rif.contents,
          name: `${basename} ${rangeStr}`,
          // Description is passed on to the LLM to give more context on file path
          description: `${relativePath} ${rangeStr}`,
          id: {
            providerTitle: "code",
            itemId: rif.filepath,
          },
        };

        let index = 0;
        for (const el of editor.getJSON().content) {
          if (el.type === "codeBlock") {
            index += 2;
          } else {
            break;
          }
        }
        editor
          .chain()
          .insertContentAt(index, {
            type: "codeBlock",
            attrs: {
              item,
            },
          })
          .run();

        if (data.prompt) {
          editor.commands.focus("end");
          editor.commands.insertContent(data.prompt);
        }

        if (data.shouldRun) {
          onEnterRef.current({ useCodebase: false, noContext: true });
        }

        setTimeout(() => {
          editor.commands.blur();
          editor.commands.focus("end");
        }, 20);
      }
      setIgnoreHighlightedCode(false);
    },
    [
      editor,
      isMainInput,
      historyLength,
      ignoreHighlightedCode,
      isMainInput,
      onEnterRef.current,
    ],
  );

  useWebviewListener(
    "isContinueInputFocused",
    async () => {
      return isMainInput && editorFocusedRef.current;
    },
    [editorFocusedRef, isMainInput],
    !isMainInput,
  );

  const [showDragOverMsg, setShowDragOverMsg] = useState(false);

  useEffect(() => {
    const overListener = (event: DragEvent) => {
      if (event.shiftKey) {
        return;
      }
      setShowDragOverMsg(true);
    };
    window.addEventListener("dragover", overListener);

    const leaveListener = (event: DragEvent) => {
      if (event.shiftKey) {
        setShowDragOverMsg(false);
      } else {
        setTimeout(() => setShowDragOverMsg(false), 2000);
      }
    };
    window.addEventListener("dragleave", leaveListener);

    return () => {
      window.removeEventListener("dragover", overListener);
      window.removeEventListener("dragleave", leaveListener);
    };
  }, []);

  const [optionKeyHeld, setOptionKeyHeld] = useState(false);
  // Prevent content flash during streaming
  useEffect(() => {
    if (editor && lastContentRef.current) {
      const currentContent = editor.getJSON();
      if (JSON.stringify(currentContent) !== JSON.stringify(lastContentRef.current)) {
        editor.commands.setContent(lastContentRef.current);
      }
    }
  }, [editor, source]);

  // clear editor content after response
  useEffect(() => {
    if (isMainInput && !active && editor) {
      editor.commands.clearContent();
    }
  }, [isMainInput, active, editor]);

  return (
    <InputBoxDiv
      onKeyDown={(e) => {
        if (e.key === "Alt") {
          setOptionKeyHeld(true);
        }
      }}
      onKeyUp={(e) => {
        if (e.key === "Alt") {
          setOptionKeyHeld(false);
        }
      }}
      className="cursor-text"
      onClick={() => {
        editor && editor.commands.focus();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setShowDragOverMsg(true);
      }}
      onDragLeave={(e) => {
        if (e.relatedTarget === null) {
          if (e.shiftKey) {
            setShowDragOverMsg(false);
          } else {
            setTimeout(() => setShowDragOverMsg(false), 2000);
          }
        }
      }}
      onDragEnter={() => {
        setShowDragOverMsg(true);
      }}
      onDrop={(event) => {
        if (
          !modelSupportsImages(
            defaultModel.provider,
            defaultModel.model,
            defaultModel.title,
            defaultModel.capabilities,
          )
        ) {
          return;
        }
        setShowDragOverMsg(false);
        const file = event.dataTransfer.files[0];
        handleImageFile(file).then(([img, dataUrl]) => {
          const { schema } = editor.state;
          const node = schema.nodes.image.create({ src: dataUrl });
          const tr = editor.state.tr.insert(0, node);
          editor.view.dispatch(tr);
        });
        event.preventDefault();
      }}
    >
      <EditorContent
        spellCheck={false}
        editor={editor}
        onClick={(event) => {
          event.stopPropagation();
        }}
      />
      <InputToolbar
        showNoContext={optionKeyHeld}
        hidden={!(editorFocusedRef.current || isMainInput)}
        onAddContextItem={() => {
          if (editor.getText().endsWith("@")) {
          } else {
            // Add space so that if there's text right before, it still activates the dropdown
            editor.commands.insertContent(" @");
          }
        }}
        onEnter={onEnterRef.current}
        onImageFileSelected={(file) => {
          handleImageFile(file).then(([img, dataUrl]) => {
            const { schema } = editor.state;
            const node = schema.nodes.image.create({ src: dataUrl });
            editor.commands.command(({ tr }) => {
              tr.insert(0, node);
              return true;
            });
          });
        }}
      />
      {showDragOverMsg &&
        modelSupportsImages(
          defaultModel.provider,
          defaultModel.model,
          defaultModel.title,
          defaultModel.capabilities,
        ) && (
          <>
            <HoverDiv></HoverDiv>
            <HoverTextDiv>Hold ⇧ to drop image</HoverTextDiv>
          </>
        )}
    </InputBoxDiv>
  );
});

export default TipTapEditor;
