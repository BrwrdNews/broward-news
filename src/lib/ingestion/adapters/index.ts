import { bsoBookingRegisterAdapter } from "./bsoBookingRegister";
import { bsoBookingBlotterAdapter }  from "./bsoBookingBlotter";
import { flpdNewsReleasesAdapter }   from "./flpdNewsReleases";
import { browardClerkManualAdapter } from "./browardClerkManualVerification";
import type { SourceAdapter, SourceType } from "../types";

export const ADAPTERS: Record<SourceType, SourceAdapter> = {
  BSO_BOOKING_REGISTER:   bsoBookingRegisterAdapter,
  BSO_BOOKING_BLOTTER:    bsoBookingBlotterAdapter,
  FLPD_NEWS_RELEASES:     flpdNewsReleasesAdapter,
  BROWARD_CLERK_MANUAL:   browardClerkManualAdapter,
  // Manual admin submission uses the same registry; adapter chosen at runtime
  MANUAL_ADMIN_SUBMISSION: bsoBookingRegisterAdapter, // fallback parser
};

export function getAdapter(sourceType: SourceType): SourceAdapter {
  const adapter = ADAPTERS[sourceType];
  if (!adapter) throw new Error(`No adapter registered for source type: ${sourceType}`);
  return adapter;
}
