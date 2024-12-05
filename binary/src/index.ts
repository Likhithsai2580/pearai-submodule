process.env.IS_BINARY = "true"; // This line sets the environment variable IS_BINARY to true, indicating that the code is running in a binary environment.
import { Command } from "commander";
import { Core } from "core/core";
import { FromCoreProtocol, ToCoreProtocol } from "core/protocol";
import { IMessenger } from "core/util/messenger";
import { getCoreLogsPath, getPromptLogsPath } from "core/util/paths";
import fs from "node:fs";
import { IpcIde } from "./IpcIde";
import { IpcMessenger } from "./IpcMessenger";
import { setupCoreLogging } from "./logging";
import { TcpMessenger } from "./TcpMessenger";

const logFilePath = getCoreLogsPath();
fs.appendFileSync(logFilePath, "[info] Starting Continue core...\n");

const program = new Command();

// This function defines the main action to be performed when the program is executed.
program.action(async () => {
  try {
    let messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>;
    if (process.env.CONTINUE_DEVELOPMENT === "true") {
      // If the environment variable CONTINUE_DEVELOPMENT is set to true, use TcpMessenger for communication.
      messenger = new TcpMessenger<ToCoreProtocol, FromCoreProtocol>();
      console.log("Waiting for connection");
      await (
        messenger as TcpMessenger<ToCoreProtocol, FromCoreProtocol>
      ).awaitConnection();
      console.log("Connected");
    } else {
      setupCoreLogging(); // Set up logging for the core application.
      // await setupCa();
      messenger = new IpcMessenger<ToCoreProtocol, FromCoreProtocol>();
    }
    const ide = new IpcIde(messenger); // Create a new instance of IpcIde with the messenger.
    const promptLogsPath = getPromptLogsPath();
    const core = new Core(messenger, ide, async (text) => {
      fs.appendFileSync(promptLogsPath, text + "\n\n");
    });
    console.log("Core started");
  } catch (e) {
    fs.writeFileSync("./error.log", `${new Date().toISOString()} ${e}\n`);
    console.log("Error: ", e);
    process.exit(1);
  }
});

program.parse(process.argv);
