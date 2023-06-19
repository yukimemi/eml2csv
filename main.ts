import * as fs from "https://deno.land/std@0.192.0/fs/mod.ts";
import * as mp from "https://esm.sh/mailparser@3.6.4";
import * as plainjs from "https://esm.sh/@json2csv/plainjs@7.0.1";
import * as transforms from "https://esm.sh/@json2csv/transforms@7.0.1";
import * as datetime from "https://deno.land/std@0.192.0/datetime/mod.ts";
import { isArray } from "https://deno.land/x/unknownutil@v2.1.1/mod.ts";
import { Command } from "https://deno.land/x/cliffy@v0.25.7/command/mod.ts";

export async function* getEmls(dir: string) {
  for await (const entry of fs.walk(dir, { exts: [".eml"] })) {
    yield entry;
  }
}

export function parseAddresses(
  address: mp.AddressObject | mp.AddressObject[],
): string {
  if (isArray<mp.AddressObject>(address)) {
    return address.map(parseAddress).join(";");
  }
  return parseAddress(address);
}

export function parseAddress(address: mp.AddressObject): string {
  return address.value.map((v) => `${v.name} <${v.address}>`).join(";");
}

export function parseDate(date: Date): string {
  return datetime.format(date, "yyyy/MM/dd HH:mm:ss.SSS");
}

export function main() {
  return new Command()
    .name("eml2csv")
    .version("0.0.1")
    .description(`Convert eml files to csv.`)
    .arguments("eml files directory path")
    .arguments("<eml_dir:string> <output_csv:string>")
    .action(async (_options, ...args) => {
      const input = args[0];
      const output = args[1];
      const csvData = [];

      for await (const entry of getEmls(input)) {
        console.log(`Open ${entry.path}`);
        const eml = await Deno.readTextFile(entry.path);
        const parsed = await mp.simpleParser(eml);
        csvData.push({
          date: parsed.date ? parseDate(parsed.date) : "",
          subject: parsed.subject,
          from: parsed.from ? parseAddress(parsed.from) : "",
          to: parsed.to ? parseAddresses(parsed.to) : "",
          cc: parsed.cc ? parseAddresses(parsed.cc) : "",
          bcc: parsed.bcc ? parseAddresses(parsed.bcc) : "",
          text: parsed.text,
          path: entry.path,
        });
      }

      const opts = {
        traansforms: [
          transforms.unwind({
            paths: [
              "subject",
              "date",
              "from",
              "to",
              "cc",
              "gcc",
              "text",
              "path",
            ],
          }),
        ],
      };
      const parser = new plainjs.Parser(opts);
      const csv = parser.parse(csvData);
      // console.log(csv);

      const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
      const data = new TextEncoder().encode(csv);
      const uint = new Uint8Array([...bom, ...data]);

      console.log(`output to ${output}`);
      await Deno.writeFile(output, uint);
    }).parse(Deno.args);
}

// Learn more at https://deno.land/manual/examples/module_metadata#concepts
if (import.meta.main) {
  await main();
}
