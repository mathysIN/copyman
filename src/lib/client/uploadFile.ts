import axios, { type AxiosResponse } from "axios";
import { toast } from "~/hooks/use-toast";
import { type AttachmentType } from "~/server/db/redis";

export async function uploadFiles(
  files: File[],
  onProgress?: (percent: number) => void,
  socketId?: string,
): Promise<AttachmentType[] | null> {
  if (files.length === 0) return [];

  let uniqueFile: File | undefined;
  if (files.length === 1) uniqueFile = files[0];

  try {
    toast({
      description: `Mise en ligne de ${uniqueFile ? uniqueFile.name : `${files.length} fichiers`
        } en cours...`,
    });

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const response: AxiosResponse<AttachmentType[]> = await axios.post(
      "/api/content/upload",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data", "x-socket-id": socketId },
        onUploadProgress: (event) => {
          if (event.total && onProgress) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error("Upload error:", error);
    toast({
      description: `Une erreur a eu lieu lors de la mise en ligne du fichier`,
      variant: "destructive",
    });
    return null;
  }
}
