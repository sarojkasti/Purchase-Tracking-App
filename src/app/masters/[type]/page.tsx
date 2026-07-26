import { notFound } from "next/navigation";
import { masterTypes } from "../masterTypes";
import SimpleMasterClient from "./SimpleMasterClient";

export function generateStaticParams() {
  return masterTypes.map((m) => ({ type: m.type }));
}

export default async function SimpleMasterPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const meta = masterTypes.find((m) => m.type === type);
  if (!meta) notFound();

  return <SimpleMasterClient type={meta.type} label={meta.label} description={meta.description} />;
}
