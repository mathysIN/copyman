"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { useEncryption } from "~/hooks/use-encryption";
import {
  faLock,
  faUnlock,
  faKey,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useToast } from "~/hooks/use-toast";
import { isEncryptionSupported, deriveAuthKey } from "~/lib/client/encryption";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export function EncryptionSettings({
  sessionId,
  isSessionEncrypted,
  hasSessionPassword,
  sessionPassword,
  createdAt,
}: {
  sessionId: string;
  isSessionEncrypted: boolean;
  hasSessionPassword: boolean;
  sessionPassword?: string;
  createdAt?: string;
}) {
  const { toast } = useToast();
  const encryption = useEncryption(sessionId, undefined, isSessionEncrypted);
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  const handleEnableEncryption = async () => {
    if (!hasSessionPassword) {
      toast({
        variant: "destructive",
        description: "Définissez d'abord un mot de passe de session",
      });
      return;
    }

    // Show password input if not already shown
    if (!showPasswordInput) {
      setShowPasswordInput(true);
      return;
    }

    if (!passwordInput) {
      toast({
        variant: "destructive",
        description: "Veuillez entrer le mot de passe de session",
      });
      return;
    }

    setIsEnabling(true);

    if (!createdAt) {
      toast({
        variant: "destructive",
        description: "Informations de session manquantes",
      });
      setIsEnabling(false);
      return;
    }

    try {
      // Derive authKey from password (raw password never sent to server)
      const authKey = await deriveAuthKey(passwordInput, createdAt);

      // Verify the authKey with the server
      const verifyResponse = await fetch(
        `/api/sessions/verify-password?sessionId=${sessionId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authKey }),
        },
      );

      const verifyResult = await verifyResponse.json();

      if (!verifyResult.valid) {
        toast({
          variant: "destructive",
          description: "Mot de passe incorrect",
        });
        setIsEnabling(false);
        return;
      }

      // Enable encryption on the server
      const response = await fetch("/api/sessions/encryption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEncrypted: true }),
      });

      if (response.ok) {
        // Enable encryption locally with the verified password and createdAt
        await encryption.enableEncryption(passwordInput, createdAt);
        toast({
          description: "Chiffrement activé avec succès",
        });
        window.location.reload();
      } else {
        toast({
          variant: "destructive",
          description: "Erreur lors de l'activation du chiffrement",
        });
      }
    } catch (e) {
      console.error("Failed to enable encryption:", e);
      toast({
        variant: "destructive",
        description: "Erreur lors de l'activation du chiffrement",
      });
    }

    setIsEnabling(false);
  };

  const handleDisableEncryption = async () => {
    setIsDisabling(true);

    try {
      const response = await fetch("/api/sessions/encryption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEncrypted: false }),
      });

      if (response.ok) {
        toast({
          description: "Chiffrement désactivé",
        });
        window.location.reload();
      } else {
        toast({
          variant: "destructive",
          description: "Erreur lors de la désactivation du chiffrement",
        });
      }
    } catch (e) {
      console.error("Failed to disable encryption:", e);
      toast({
        variant: "destructive",
        description: "Erreur lors de la désactivation du chiffrement",
      });
    }

    setIsDisabling(false);
  };

  if (!isEncryptionSupported()) {
    return null;
  }

  const isEffectivelyEncrypted = encryption.isEnabled && isSessionEncrypted;

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div>
        <p className="font-medium">Chiffrement E2EE</p>
        <p className="text-sm text-muted-foreground">
          {isEffectivelyEncrypted
            ? "Chiffrement activé"
            : "Chiffrement désactivé"}
        </p>
      </div>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            className={`min-w-[100px] ${
              isEffectivelyEncrypted
                ? "bg-green-600 hover:bg-green-700"
                : "bg-neutral-700 hover:bg-neutral-600"
            }`}
          >
            <FontAwesomeIcon
              icon={isEffectivelyEncrypted ? faLock : faUnlock}
              className="mr-2 h-4 w-4"
            />
            {isEffectivelyEncrypted ? "Activé" : "Désactivé"}
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-stone-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FontAwesomeIcon icon={faKey} />
              Chiffrement de bout en bout
            </DialogTitle>
            <DialogDescription className="text-gray-300">
              Le chiffrement de bout en bout (E2EE) protège vos données en les
              chiffrant sur votre appareil avant l&apos;envoi. Seuls les
              appareils avec le mot de passe de session peuvent déchiffrer le
              contenu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isEffectivelyEncrypted ? (
              <>
                <div className="rounded-lg bg-green-600/20 p-4 text-green-400">
                  <p className="flex items-center gap-2 font-medium">
                    <FontAwesomeIcon icon={faLock} />
                    Chiffrement activé
                  </p>
                  <p className="mt-2 text-sm text-green-300">
                    Vos notes et fichiers sont chiffrés. Tous les participants
                    avec le mot de passe de session peuvent les déchiffrer.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-gray-400">
                    Le chiffrement utilise le mot de passe de session. Partagez
                    ce mot de passe avec les autres participants pour
                    qu&apos;ils puissent accéder au contenu.
                  </p>
                </div>

                <div className="border-t border-stone-600 pt-4">
                  <Button
                    onClick={handleDisableEncryption}
                    disabled={isDisabling}
                    variant="destructive"
                    className="w-full"
                  >
                    {isDisabling
                      ? "Désactivation..."
                      : "Désactiver le chiffrement"}
                  </Button>
                  <p className="mt-2 text-xs text-gray-500">
                    Attention : Le contenu chiffré existant deviendra illisible
                    après la désactivation.
                  </p>
                </div>

                {encryption.needsPassword && (
                  <div className="rounded-lg bg-yellow-600/20 p-4 text-yellow-400">
                    <p className="flex items-center gap-2 font-medium">
                      <FontAwesomeIcon icon={faExclamationTriangle} />
                      Mot de passe requis
                    </p>
                    <p className="mt-2 text-sm text-yellow-300">
                      Cette session est chiffrée mais le mot de passe n&apos;est
                      pas disponible sur cet appareil. Rejoignez la session avec
                      le mot de passe pour déchiffrer le contenu.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                {!hasSessionPassword ? (
                  <div className="rounded-lg bg-yellow-600/20 p-4 text-yellow-400">
                    <p className="flex items-center gap-2 font-medium">
                      <FontAwesomeIcon icon={faExclamationTriangle} />
                      Mot de passe requis
                    </p>
                    <p className="mt-2 text-sm text-yellow-300">
                      Définissez un mot de passe de session dans les paramètres
                      pour activer le chiffrement de bout en bout.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg bg-neutral-700 p-4 text-gray-300">
                      <p className="font-medium">Activer le chiffrement ?</p>
                      <p className="mt-2 text-sm text-gray-400">
                        Le chiffrement utilisera le mot de passe de session
                        actuel. Tous les participants devront connaître ce mot
                        de passe pour accéder au contenu.
                      </p>
                    </div>

                    {showPasswordInput && (
                      <div className="space-y-2">
                        <Label htmlFor="e2ee-password" className="text-white">
                          Mot de passe de session
                        </Label>
                        <Input
                          id="e2ee-password"
                          type="password"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder="Entrez le mot de passe"
                          className="border-stone-600 bg-stone-700 text-white"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleEnableEncryption();
                            }
                          }}
                        />
                        <p className="text-xs text-gray-500">
                          Le mot de passe est vérifié mais n&apos;est jamais
                          stocké sur le serveur.
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={handleEnableEncryption}
                      disabled={isEnabling}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {isEnabling ? "Activation..." : "Activer le chiffrement"}
                    </Button>
                  </>
                )}

                <div className="rounded-lg bg-blue-600/20 p-4 text-blue-400">
                  <p className="text-sm">
                    <strong>Note :</strong> Le mot de passe de session ne peut
                    pas être modifié une fois le chiffrement activé sans perdre
                    l&apos;accès au contenu existant.
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
