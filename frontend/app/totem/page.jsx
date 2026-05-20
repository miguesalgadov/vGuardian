"use client";

import dynamic from "next/dynamic";

const Totem = dynamic(() => import("../../Totem"), { ssr: false });

export default function TotemPage() {
  return <Totem />;
}
