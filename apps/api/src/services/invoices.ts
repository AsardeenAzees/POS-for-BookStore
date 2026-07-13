export function makeInvoiceNumber(branchCode: string, sequence: number) {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `${branchCode}-${ymd}-${String(sequence).padStart(5, "0")}`;
}

export function buildInvoiceSms(input: {
  businessName: string;
  invoiceNumber: string;
  total: number;
  paymentMethod: string;
  contact?: string | null;
}) {
  const paidBy = input.paymentMethod.replace("_", " ").toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
  const contact = input.contact ? ` Contact: ${input.contact}` : "";
  return `${input.businessName} Invoice ${input.invoiceNumber}. Total LKR ${input.total.toLocaleString()}. Paid by ${paidBy}. Thank you.${contact}`;
}
