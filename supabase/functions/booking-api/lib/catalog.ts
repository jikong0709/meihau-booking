export type ServiceRow = {
  service_id: string;
  team_id: string | null;
  category_id: "temporary_staff" | "recording_space" | "ai_digital" | "venue_equipment" | "learning";
  service_name: string;
  price: number | null;
  price_type: "fixed" | "starting_from" | "custom_quote";
  pricing_type: "fixed" | "quote" | "current_campaign" | "contact" | null;
  price_note: string;
  booking_type: "direct_booking" | "custom_quote";
  service_type: "recording" | "ai_digital" | "staff" | "space" | "companion" | null;
  price_unit: "session" | "hour" | "half_day" | "day" | "project" | null;
  included_hours: number | null;
  min_hours: number | null;
  additional_hour_price: number | null;
  companion_modes: Array<"quiet" | "low_interaction" | "together" | "body_doubling">;
  requires_provider: boolean;
};

type AddonRow = {
  addon_id: string;
  addon_name: string;
  addon_price: number | null;
  available_for: string[];
};

export function selectedIds(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter(Boolean))].slice(0, 10);
}

export async function loadActiveService(db: any, serviceId: string) {
  const { data, error } = await db.schema("booking").from("services").select("*")
    .eq("service_id", serviceId).eq("service_status", "active").maybeSingle();
  if (error || !data) throw new Error("invalid_service");
  return data as ServiceRow;
}

export async function buildQuote(db: any, input: Record<string, unknown>) {
  const service = await loadActiveService(db, String(input.service_id || ""));
  if (service.booking_type !== "direct_booking" || service.price === null) throw new Error("inquiry_required");
  const rawHours = input.hours;
  const hours = rawHours === undefined || rawHours === null || rawHours === ""
    ? (service.included_hours ?? service.min_hours ?? 1)
    : Number(rawHours);
  if (!Number.isInteger(hours) || hours < 1 || hours > 12 || (service.min_hours !== null && hours < service.min_hours)) throw new Error("invalid_hours");
  let serviceAmount = service.price;
  if (service.price_unit === "hour") serviceAmount = service.price * hours;
  else if (service.included_hours !== null && hours > service.included_hours) {
    if (service.additional_hour_price === null) throw new Error("invalid_hours");
    serviceAmount += (hours - service.included_hours) * service.additional_hour_price;
  }
  const companionMode = String(input.companion_mode || "");
  const workGoal = String(input.work_goal || "").trim();
  if (workGoal.length > 500) throw new Error("invalid_work_goal");
  if (service.service_type === "companion" && (!companionMode || !service.companion_modes.includes(companionMode as ServiceRow["companion_modes"][number]))) throw new Error("invalid_companion_mode");
  const lines = [{ label: service.service_name, amount: serviceAmount }];
  const selectedAddonIds = selectedIds(input, "selected_addon_ids");
  const pendingAddons: AddonRow[] = [];
  let total = serviceAmount;
  if (selectedAddonIds.length) {
    const { data, error } = await db.schema("booking").from("service_addons").select("*").in("addon_id", selectedAddonIds).eq("status", "active");
    if (error || !data || data.length !== selectedAddonIds.length) throw new Error("invalid_addon");
    const allowedTags: Record<ServiceRow["category_id"], string[]> = {
      recording_space: ["recording", "podcast"], venue_equipment: ["photo", "event"], temporary_staff: ["event"], ai_digital: [], learning: [],
    };
    for (const addon of data as AddonRow[]) {
      if (!addon.available_for.some((tag) => allowedTags[service.category_id].includes(tag))) throw new Error("invalid_addon");
      if (addon.addon_price === null) pendingAddons.push(addon);
      else { total += addon.addon_price; lines.push({ label: addon.addon_name, amount: addon.addon_price }); }
    }
  }
  const optionId = String(input.option_id || "");
  if (optionId) {
    const { data, error } = await db.schema("booking").from("service_options").select("option_id,option_name")
      .eq("option_id", optionId).eq("service_id", service.service_id).eq("status", "active").maybeSingle();
    if (error || !data) throw new Error("invalid_option");
  }
  return {
    category: service.category_id, service_id: service.service_id, price_type: service.price_type,
    booking_details: { hours, companion_mode: service.service_type === "companion" ? companionMode : null, work_goal: service.service_type === "companion" ? workGoal : "" },
    lines, pending_addons: pendingAddons.map(({ addon_id, addon_name }) => ({ addon_id, addon_name })), total,
  };
}
