import { PortalAppointmentsPage } from "../../../components/portal/portal-appointments-page";

type Props = {
  searchParams: Promise<{ businessId?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  return <PortalAppointmentsPage businessId={params.businessId} />;
}
