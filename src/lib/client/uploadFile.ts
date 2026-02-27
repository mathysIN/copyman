import axios, { type AxiosResponse } from "axios";
import { toast } from "~/hooks/use-toast";
import { type AttachmentType } from "~/server/db/redis";
import { encryptFile, type EncryptionKey } from "~/lib/client/encryption";

export type EncryptFileFunction = (
  file: File,
) => Promise<{ encryptedFile: Blob; iv: string; salt: string }>;

export async function uploadFiles(
  files: File[],
  onProgress?: (percent: number) => void,
  socketUserId?: string,
  encryptionKey?: CryptoKey | null,
): Promise<AttachmentType[] | null> {
  if (files.length === 0) return [];

  let uniqueFile: File | undefined;
  if (files.length === 1) uniqueFile = files[0];

  try {
    const isEncrypted = !!encryptionKey;
    console.log(
      "[E2EE] uploadFiles: encryption enabled:",
      isEncrypted,
      "files count:",
      files.length,
    );

    toast({
      description: `Mise en ligne de ${
        uniqueFile ? uniqueFile.name : `${files.length} fichiers`
      } ${isEncrypted ? "(chiffré)" : ""} en cours...`,
    });

    const formData = new FormData();
    const encryptedMeta: {
      isEncrypted: boolean;
      encryptedIv: string;
      encryptedSalt: string;
    }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;

      if (encryptionKey) {
        console.log("[E2EE] Encrypting file:", file.name, "size:", file.size);
        const encrypted = await encryptFile(file, encryptionKey);
        console.log(
          "[E2EE] File encrypted, new size:",
          encrypted.encryptedData.size,
        );
        formData.append("files", encrypted.encryptedData, file.name);
        encryptedMeta.push({
          isEncrypted: true,
          encryptedIv: encrypted.iv,
          encryptedSalt: encrypted.salt,
        });
      } else {
        formData.append("files", file);
        encryptedMeta.push({
          isEncrypted: false,
          encryptedIv: "",
          encryptedSalt: "",
        });
      }
    }

    formData.append("encryptedMeta", JSON.stringify(encryptedMeta));

    const response: AxiosResponse<AttachmentType[]> = await axios.post(
      "/api/content/upload",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          "X-Socket-User-Id": socketUserId ?? "",
        },
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
