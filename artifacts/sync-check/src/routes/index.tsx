import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Punjab Case Management" },
      { name: "description", content: "Punjab Case Management — secure user portal." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/user" });
  },
});
