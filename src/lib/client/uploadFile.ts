import { toast } from "~/hooks/use-toast";
import { AttachmentType } from "~/server/db/redis";

export async function uploadFiles(
  files: { file: string; fileName: string; mimeType: string }[],
): Promise<AttachmentType[] | null> {
  if (files.length == 0) return [];
  let uniqueFile:
    | { file: string; fileName: string; mimeType: string }
    | undefined;
  if (files.length == 1) {
    uniqueFile = files[0];
  }

  try {
    toast({
      description: `Mise en ligne de ${uniqueFile ? uniqueFile.fileName : `${files.length} fichiers`} en cours...`,
    });
    const response = await fetch("/api/content/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(files),
    });

    const result = (await response.json()) as AttachmentType[];
    if (!response.ok) throw new Error("Upload failed");
    return result;
  } catch (error) {
    console.error("Upload error:", error);
    toast({
      description: `Une erreur a eu lieu lors de la mise en ligne du fichier}`,
      variant: "destructive",
    });
    return null;
  }
}
