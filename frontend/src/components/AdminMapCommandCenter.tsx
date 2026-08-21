import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Complaint, PriorityLevel, ComplaintStatus } from '../types/database.types';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { Filter, MapPin, Eye } from 'lucide-react';

// Custom Colored Leaflet Icons
const createCustomMarkerIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color:${color}; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
};

const MARKER_COLORS: Record<string, string> = {
  Submitted: '#64748b',
  Verified: '#2563eb',
  Approved: '#3b82f6',
  'Department Assigned': '#0284c7',
  'Staff Assigned': '#06b6d4',
  'In Progress': '#d97706',
  'Resolution Submitted': '#7c3aed',
  Resolved: '#059669',
  Reopened: '#ea580c',
  Critical: '#e11d48'
};

interface MapCommandCenterProps {
  complaints: Complaint[];
  onSelectComplaint: (complaint: Complaint) => void;
}

export const AdminMapCommandCenter: React.FC<MapCommandCenterProps> = ({
  complaints,
  onSelectComplaint
}) => {
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  const filtered = complaints.filter((c) => {
    const matchesDept = selectedDept === 'All' || (c.department_name && c.department_name.includes(selectedDept));
    const matchesPriority = selectedPriority === 'All' || c.priority === selectedPriority;
    const matchesStatus = selectedStatus === 'All' || c.status === selectedStatus;
    return matchesDept && matchesPriority && matchesStatus;
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
      
      {/* Live Map Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4 text-xs">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-emerald-600" />
          <h3 className="font-extrabold text-gray-900 font-outfit text-sm">Interactive City Map Filters</h3>
          <span className="text-gray-400">({filtered.length} Markers Shown)</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 block uppercase">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs text-gray-900 focus:border-emerald-500 font-semibold"
            >
              <option value="All">All Departments</option>
              <option value="Public Works">Public Works (PWD)</option>
              <option value="Sanitation">Sanitation & Waste</option>
              <option value="Water">Water Supply</option>
              <option value="Electrical">Electrical & Lighting</option>
              <option value="Traffic">Traffic Management</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 block uppercase">Priority</label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs text-gray-900 focus:border-emerald-500 font-semibold"
            >
              <option value="All">All Priorities</option>
              <option value="Critical">Critical Only</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 block uppercase">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs text-gray-900 focus:border-emerald-500 font-semibold"
            >
              <option value="All">All Statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Approved">Approved</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolution Submitted">Resolution Submitted</option>
              <option value="Resolved">Resolved</option>
              <option value="Reopened">Reopened</option>
            </select>
          </div>
        </div>
      </div>

      {/* Map Container */}
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

          {filtered.map((c) => {
            const markerColor = c.priority === 'Critical' ? MARKER_COLORS.Critical : (MARKER_COLORS[c.status] || '#059669');
            const icon = createCustomMarkerIcon(markerColor);

            return (
              <Marker
                key={c.id}
                position={[Number(c.latitude), Number(c.longitude)]}
                icon={icon}
              >
                <Popup>
                  <div className="space-y-2 p-1 text-xs max-w-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-emerald-700">{c.complaint_number}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <h4 className="font-extrabold text-gray-900 leading-snug">{c.title}</h4>
                    <p className="text-[11px] text-gray-600 line-clamp-2">{c.description}</p>
                    <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                      <PriorityBadge priority={c.priority} />
                      <button
                        onClick={() => onSelectComplaint(c)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px] flex items-center space-x-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect Drawer</span>
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

    </div>
  );
};
