export type FleetCarSpec = { icon: string; label: string };

export type FleetCar = {
  /** صف `Fleet` — للعرض والمفتاح فقط */
  id: number;
  /** معرّف `CarModel` — للحجز المباشر */
  modelId: number;
  name: string;
  subtitle: string;
  price: string;
  image: string;
  alt: string;
  badge?: string | null;
  specs: FleetCarSpec[];
};
