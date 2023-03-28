import events from "events";
import fs from "fs";
import readline from "readline";

export async function lineByLine(file: string, fn: (line: string) => void): Promise<void> {
    const rl = readline.createInterface({
        input: fs.createReadStream(file),
        crlfDelay: Infinity
    });

    rl.on('line', (line: string) => fn(line));

    await events.once(rl, 'close');
}