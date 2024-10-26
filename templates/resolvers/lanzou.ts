import { ResolverParameters, ResolverReturned } from "../../src/class";
import { Ok, Err, Result } from "ts-results";
import { log } from "../../src/utils";
import { loadShareUrl } from "lanzou-api";

export default async function (
  p: ResolverParameters,
): Promise<Result<ResolverReturned, string>> {
  const { downloadLink, password, cd, fileMatchRegex } = p;

  if (cd?.length) {
    log(
      `Warning:Resolver template 'Lanzou' doesn't support cd currently, ignoring cd array : '${JSON.stringify(
        cd,
      )}'`,
    );
  }

  const res = await loadShareUrl(downloadLink, password);
  if (res.isErr()) {
    return new Err(res.unwrapErr());
  }
  const data = res.unwrap();

  if (data.type === "file") {
    log(
      `Info:Parsed file : '${data.name}', download link : '${data.downloadUrl}'`,
    );
    return new Ok({
      directLink: data.downloadUrl,
    });
  } else {
    log(`Info:Folder share found, matching with regex '${fileMatchRegex}'`);
    const { nodes } = data;
    const regex = new RegExp(fileMatchRegex);
    for (const { name_all, shareUrl } of nodes) {
      if (regex.test(name_all)) {
        log(`Info:Matched file '${name_all}'`);
        const r = await loadShareUrl(shareUrl);
        if (r.isErr()) {
          return new Err(r.unwrapErr());
        } else {
          const d = r.unwrap();
          if (d.type === "folder") {
            return new Err(
              "Error:Matched folder '${name}', not file; Cd param hasn't been supported yet",
            );
          }
          return new Ok({
            directLink: d.downloadUrl,
          });
        }
      }
    }
    return new Err("Error:Can't match file");
  }
}
