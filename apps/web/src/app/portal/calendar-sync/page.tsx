import { PortalCalendarSyncPage } from "../../../components/portal/portal-calendar-sync-page";

type Props = {
  searchParams: Promise<{ businessId?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  return <PortalCalendarSyncPage businessId={params.businessId} />;
}
