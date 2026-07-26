import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AgentFreightRatesEditor from "./AgentFreightRatesEditor";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await prisma.agent.findUnique({
    where: { id },
    include: { vendors: true },
  });
  if (!agent) notFound();

  return (
    <div>
      <div className="mb-4">
        <Link href="/masters/agents" className="text-sm text-blue-600 hover:underline">
          ← Agents
        </Link>
        <h1 className="text-xl font-semibold mt-1">{agent.name}</h1>
        {agent.vendors.length > 0 && (
          <p className="text-sm text-gray-500">
            Vendors: {agent.vendors.map((v) => v.name).join(", ")}
          </p>
        )}
      </div>

      <AgentFreightRatesEditor agentId={agent.id} />
    </div>
  );
}
