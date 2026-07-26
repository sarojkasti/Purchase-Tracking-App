import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import VendorForm from "../VendorForm";
import PaymentPolicyEditor from "./PaymentPolicyEditor";

export default async function EditVendorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vendor = await prisma.vendor.findUnique({ where: { id }, include: { agent: true } });
  if (!vendor) notFound();

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Edit Vendor</h1>
      <VendorForm vendor={vendor} />
      <PaymentPolicyEditor vendorId={vendor.id} />

      <div className="max-w-2xl bg-white border rounded p-6 mt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-1">Freight Rates</h3>
        {vendor.agent ? (
          <p className="text-sm text-gray-600">
            Freight rates are managed on the agent&apos;s page:{" "}
            <Link href={`/masters/agents/${vendor.agent.id}`} className="text-blue-600 hover:underline">
              {vendor.agent.name}
            </Link>
          </p>
        ) : (
          <p className="text-sm text-gray-500">
            Assign an agent above to see and manage this vendor&apos;s freight rates.
          </p>
        )}
      </div>
    </div>
  );
}
