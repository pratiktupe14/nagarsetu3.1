export type LatLng = {
  lat: number;
  lng: number;
};

export type NagarSetuComplaint = {
  id: string;
  complaintNumber?: string;
  category: string;
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  latitude: number;
  longitude: number;
  location_address?: string;
  department_name?: string;
};
