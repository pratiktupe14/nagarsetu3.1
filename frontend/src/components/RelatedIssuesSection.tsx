import React from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Complaint } from '../types/database.types';
import { findRelatedNearbyIssues } from '../services/locationService';
import { RelatedIssueCard } from './RelatedIssueCard';
import { StatusBadge } from './StatusBadge';
import { MapPin, ShieldCheck, PlusCircle } from 'lucide-react';

interface RelatedIssuesSectionProps {
  currentComplaint: Complaint;
  allComplaints: Complaint[];
  onRefresh?: () => void;
}

// Leaflet Marker Icon Generator
function createCustomIcon(color: string) {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
}

const emeraldIcon = createCustomIcon('#059669');
const amberIcon = createCustomIcon('#d97706');
const greenIcon = createCustomIcon('#10b981');
const roseIcon = createCustomIcon('#e11d48');
const blueIcon = createCustomIcon('#2563eb');

function getMarkerIcon(status: string, isCurrent: boolean) {
  if (isCurrent) return emeraldIcon;
  if (status === 'Critical') return roseIcon;
  if (status === 'Resolved') return greenIcon;
  if (status === 'In Progress' || status === 'On the Way') return amberIcon;
  return blueIcon;
}

export const RelatedIssuesSection: React.FC<RelatedIssuesSectionProps> = ({
  currentComplaint,
  allComplaints,
  onRefresh
}) => {
  const relatedItems = findRelatedNearbyIssues(
    Number(currentComplaint.latitude),
    Number(currentComplaint.longitude),
    currentComplaint.category,
    currentComplaint.id,
    allComplaints,
    500
  );

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6 font-sans">
      
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-xl font-extrabold text-gray-900 font-outfit flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <span>Related Issues Nearby</span>
          </h3>
          <p className="text-xs text-gray-600 mt-0.5">
            Civic complaints detected within 500 meters radius.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-[10px] font-mono font-bold">
          <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /><span>Current</span></span>
          <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /><span>In Progress</span></span>
          <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /><span>Resolved</span></span>
          <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /><span>Nearby</span></span>
        </div>
      </div>

      {/* NEARBY MAP OVERVIEW */}
      <div className="rounded-2xl overflow-hidden border border-gray-200 h-64 relative z-0">
        <MapContainer
          center={[Number(currentComplaint.latitude), Number(currentComplaint.longitude)]}
          zoom={16}
          scrollWheelZoom={false}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* CURRENT COMPLAINT MARKER */}
          <Marker
            position={[Number(currentComplaint.latitude), Number(currentComplaint.longitude)]}
            icon={emeraldIcon}
          >
            <Popup>
              <div className="text-xs font-sans space-y-1">
                <span className="font-mono font-bold text-emerald-700 block">CURRENT ISSUE: {currentComplaint.complaint_number}</span>
                <strong className="block text-gray-900">{currentComplaint.title}</strong>
                <StatusBadge status={currentComplaint.status} />
              </div>
            </Popup>
          </Marker>

          {/* RELATED NEARBY MARKERS */}
          {relatedItems.map(({ complaint, distanceMeters }) => (
            <Marker
              key={complaint.id}
              position={[Number(complaint.latitude), Number(complaint.longitude)]}
              icon={getMarkerIcon(complaint.status, false)}
            >
              <Popup>
                <div className="text-xs font-sans space-y-1 min-w-[160px]">
                  <span className="font-mono font-bold text-blue-700 block">{complaint.complaint_number} ({distanceMeters}m away)</span>
                  <strong className="block text-gray-900">{complaint.title}</strong>
                  <StatusBadge status={complaint.status} />
                  <div className="pt-1">
                    <Link
                      to={`/citizen/complaint/${complaint.id}`}
                      className="text-[10px] text-emerald-700 font-extrabold underline block"
                    >
                      View Complaint →
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

        </MapContainer>
      </div>

      {/* RELATED ISSUES CARDS GRID */}
      {relatedItems.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-gray-200 rounded-2xl space-y-3 bg-gray-50/50">
          <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto" />
          <h4 className="text-sm font-extrabold text-gray-900 font-outfit">No Related Issues Nearby</h4>
          <p className="text-xs text-gray-500">No similar civic complaints were found within this immediate area.</p>
          <Link
            to="/citizen/report"
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs uppercase min-h-[44px]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Report a Civic Issue</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {relatedItems.map((item) => (
            <RelatedIssueCard key={item.complaint.id} item={item} onSupportUpdated={onRefresh} />
          ))}
        </div>
      )}

    </div>
  );
};
