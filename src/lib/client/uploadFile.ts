import { toast } from "~/hooks/use-toast";
import { AttachmentType } from "~/server/db/redis";

export async function uploadFiles(
  files: File[],
): Promise<AttachmentType[] | null> {
  if (files.length == 0) return [];
  let uniqueFile: File | undefined;
  if (files.length == 1) {
    uniqueFile = files[0];
  }

  try {
    toast({
      description: `Mise en ligne de ${uniqueFile ? uniqueFile.name : `${files.length} fichiers`} en cours...`,
    });
    const formData = new FormData();

    files.forEach((file) => {
      formData.append("files", file);
    });

    const response = await fetch("/api/content/upload", {
      method: "POST",
      body: formData,
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
