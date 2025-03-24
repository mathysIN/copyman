import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Copyman",
    short_name: "Copyman",
    description: "Un presse papier pas sécurisé mais pratique pour mon travail",
    start_url: "/",
    display: "standalone",
    background_color: "#287d7c",
    theme_color: "#287d7c",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
    share_target: {
      action: "/share",
      method: "post",
      enctype: "multipart/form-data",
      params: [
        {
          name: "title",
          value: "title",
          required: true,
        },
      ],
    },
  };
}
