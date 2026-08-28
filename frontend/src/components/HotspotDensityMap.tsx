import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { Complaint } from '../types/database.types';
import { calculateHotspotClusters, HotspotCluster } from '../services/analyticsService';
import { Flame, Info } from 'lucide-react';

interface HotspotDensityMapProps {
  complaints: Complaint[];
}

const DENSITY_COLORS: Record<string, { fill: string; border: string; radius: number }> = {
  High: { fill: '#e11d48', border: '#9f1239', radius: 24 },
  Medium: { fill: '#d97706', border: '#92400e', radius: 18 },
  Low: { fill: '#2563eb', border: '#1e40af', radius: 12 }
};

export const HotspotDensityMap: React.FC<HotspotDensityMapProps> = ({ complaints }) => {
  const clusters = calculateHotspotClusters(complaints, 300);

  const highCount = clusters.filter((c) => c.densityLevel === 'High').length;
  const mediumCount = clusters.filter((c) => c.densityLevel === 'Medium').length;
  const lowCount = clusters.filter((c) => c.densityLevel === 'Low').length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4 font-sans">
      
      {/* Header & Density Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-1.5 font-extrabold text-gray-900 font-outfit text-base">
            <Flame className="w-5 h-5 text-rose-600" />
            <h3>Municipal Hotspot & Density Analysis</h3>
          </div>
          <p className="text-xs text-gray-500">Clusters complaints by GPS proximity (300m radius) to identify high-density municipal defect zones.</p>
        </div>

        {/* Density Legend Badges */}
        <div className="flex items-center space-x-3 text-xs font-semibold">
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
            <span>High Density ({highCount})</span>
          </span>

          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
            <span>Medium Density ({mediumCount})</span>
          </span>

          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <span>Low Density ({lowCount})</span>
          </span>
        </div>
      </div>

      {/* Leaflet Hotspot Map */}
      <div className="w-full h-96 rounded-xl overflow-hidden border border-gray-200 shadow-xs relative bg-white">
        <MapContainer
          center={[20.0059, 73.7898]}
          zoom={13}
          scrollWheelZoom={false}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {clusters.map((cluster) => {
            const style = DENSITY_COLORS[cluster.densityLevel] || DENSITY_COLORS.Low;

            return (
              <CircleMarker
                key={cluster.id}
                center={[cluster.latitude, cluster.longitude]}
                radius={style.radius}
                pathOptions={{
                  fillColor: style.fill,
                  fillOpacity: 0.6,
                  color: style.border,
                  weight: 2
                }}
              >
                <Popup>
                  <div className="p-1 space-y-1 text-xs max-w-xs font-sans">
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase tracking-wider font-outfit" style={{ color: style.fill }}>
                        {cluster.densityLevel} Density Cluster
                      </span>
                      <span className="font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                        {cluster.complaintCount} Issue(s)
                      </span>
                    </div>

                    <p className="text-gray-600 text-[11px]">
                      <strong>Defect Categories:</strong> {cluster.categories.join(', ')}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono">
                      GPS: {cluster.latitude.toFixed(4)}, {cluster.longitude.toFixed(4)}
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

    </div>
  );
};
