/**
 * POLARIS — Ecosystem module map.  Ticket #145 / #146.
 * POLARIS_PLATFORM_UX.md §4. The canonical list of platform modules and the
 * stakeholder types connected to the ecosystem. Module names here are final.
 */

export type ModuleCategory = "core" | "operations" | "agency" | "logistics" | "crew" | "finance" | "other";

export interface PolarisModule {
  id: string;
  name: string;
  category: ModuleCategory;
  description: string;
  icon: string;        // Tabler icon name
  accentColor: string;
}

export const POLARIS_MODULES: PolarisModule[] = [
  { id: "leo", name: "Leo", category: "core", description: "AI Intelligence — The intelligence behind Polaris", icon: "ti-robot", accentColor: "#E8A020" },

  { id: "orbit", name: "ORBIT", category: "operations", description: "Operations & Small Boat Management", icon: "ti-sailboat", accentColor: "#00C4CC" },
  { id: "transport", name: "Transport & Fleet", category: "operations", description: "Vessel deliveries, logistics, transport", icon: "ti-car", accentColor: "#00C4CC" },
  { id: "yacht_it", name: "Yacht IT Solutions", category: "operations", description: "IT support, cyber security, connectivity, networks", icon: "ti-device-laptop", accentColor: "#00C4CC" },

  { id: "agency", name: "Superyacht Middle East", category: "agency", description: "Agency + port calls + clearances + berthing + fuel + local support", icon: "ti-map-pin", accentColor: "#00C4CC" },

  { id: "shipsync", name: "ShipSync", category: "logistics", description: "Ship spares + logistics + customs + storage", icon: "ti-package", accentColor: "#00C4CC" },
  { id: "waypoint", name: "Waypoint", category: "logistics", description: "Chandlery + procurement + suppliers", icon: "ti-shopping-cart", accentColor: "#00C4CC" },
  { id: "provisioning", name: "Superyacht Provisioning", category: "logistics", description: "Provisions + interiors + pantry + events + special orders", icon: "ti-basket", accentColor: "#00C4CC" },

  { id: "crew_immigration", name: "Crew & Immigration", category: "crew", description: "Visas + passports + gate passes + crew movements", icon: "ti-passport", accentColor: "#E8A020" },
  { id: "crew_placement", name: "Crew Placement", category: "crew", description: "Placements + daywork + crew solutions", icon: "ti-users", accentColor: "#E8A020" },
  { id: "training", name: "JLS Yacht Training Institute", category: "crew", description: "Training + certification + development", icon: "ti-certificate", accentColor: "#E8A020" },

  { id: "finance", name: "Finance", category: "finance", description: "Invoices + SOA + payments + QuickBooks integration", icon: "ti-currency-dollar", accentColor: "#00C4CC" },

  { id: "compass_card", name: "Compass Card", category: "other", description: "Crew benefit card", icon: "ti-credit-card", accentColor: "#00C4CC" },
];

export interface ConnectedStakeholder {
  id: string;
  label: string;
  icon: string;
}

export const CONNECTED_STAKEHOLDERS: ConnectedStakeholder[] = [
  { id: "owners", label: "Owners", icon: "ti-user-circle" },
  { id: "family_offices", label: "Family Offices", icon: "ti-building" },
  { id: "captains", label: "Captains", icon: "ti-steering-wheel" },
  { id: "crew", label: "Crew", icon: "ti-users" },
  { id: "yacht_managers", label: "Yacht Managers", icon: "ti-briefcase" },
  { id: "agents", label: "Agents", icon: "ti-map-pin" },
  { id: "suppliers", label: "Suppliers", icon: "ti-package" },
  { id: "marinas", label: "Marinas", icon: "ti-anchor" },
  { id: "authorities", label: "Authorities", icon: "ti-building-bank" },
  { id: "partners", label: "Partners", icon: "ti-handshake" },
];

export const MODULES_BY_CATEGORY = (): Record<ModuleCategory, PolarisModule[]> => {
  const out = { core: [], operations: [], agency: [], logistics: [], crew: [], finance: [], other: [] } as Record<ModuleCategory, PolarisModule[]>;
  for (const m of POLARIS_MODULES) out[m.category].push(m);
  return out;
};

export const getModule = (id: string): PolarisModule | undefined => POLARIS_MODULES.find((m) => m.id === id);
