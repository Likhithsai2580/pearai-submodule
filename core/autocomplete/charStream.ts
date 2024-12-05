export async function* onlyWhitespaceAfterEndOfLine(
  stream: AsyncGenerator<string>,
  endOfLine: string[],
  fullStop: () => void,
): AsyncGenerator<string> {
  // This function stops the stream if only whitespace is found after the end of a line.
  let pending = "";
  for await (let chunk of stream) {
    chunk = pending + chunk;
    pending = "";
    for (let i = 0; i < chunk.length - 1; i++) {
      if (
        endOfLine.includes(chunk[i]) &&
        chunk[i + 1].trim() === chunk[i + 1]
      ) {
        yield chunk.slice(0, i + 1);
        fullStop();
        return;
      }
    }
    if (endOfLine.includes(chunk[chunk.length - 1])) {
      pending = chunk[chunk.length - 1];
      yield chunk.slice(0, chunk.length - 1);
    } else {
      yield chunk;
    }
  }
  yield pending;
}

export async function* noFirstCharNewline(stream: AsyncGenerator<string>) {
  // This function ensures that the first character of the stream is not a newline.
  let first = true;
  for await (const char of stream) {
    if (first) {
      first = false;
      if (char.startsWith("\n") || char.startsWith("\r")) {
        return;
      }
    }
    yield char;
  }
}

export async function* stopAtStopTokens(
  stream: AsyncGenerator<string>,
  stopTokens: string[],
): AsyncGenerator<string> {
  // This function stops the stream when any of the specified stop tokens are encountered.
  if (stopTokens.length === 0) {
    for await (const char of stream) {
      yield char;
    }
    return;
  }

  const maxStopTokenLength = Math.max(
    ...stopTokens.map((token) => token.length),
  );
  let buffer = "";

  for await (const chunk of stream) {
    buffer += chunk;

    while (buffer.length >= maxStopTokenLength) {
      let found = false;
      for (const stopToken of stopTokens) {
        if (buffer.startsWith(stopToken)) {
          found = true;
          return;
        }
      }

      if (!found) {
        yield buffer[0];
        buffer = buffer.slice(1);
      }
    }
  }

  // Yield any remaining characters in the buffer
  for (const char of buffer) {
    yield char;
  }
}
