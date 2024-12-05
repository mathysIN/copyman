import { type useToast } from "~/hooks/use-toast";

type UseToastType = typeof useToast;
type _ = ReturnType<UseToastType>;
type __ = _["toast"];

export function copyAndToast(Toast: __, text: string) {
  navigator.clipboard.writeText(text);
  Toast({
    description: "Le contenu a bien été copié",
    title: "",
  });
}
