import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { RelatedIssueItem } from '../services/locationService';
import { supportDuplicateComplaint } from '../services/complaintService';
import { StatusBadge } from './StatusBadge';
import { MapPin, ThumbsUp, ArrowRight, Building2, Calendar, ShieldCheck } from 'lucide-react';

interface RelatedIssueCardProps {
  item: RelatedIssueItem;
  onSupportUpdated?: () => void;
}

export const RelatedIssueCard: React.FC<RelatedIssueCardProps> = ({ item, onSupportUpdated }) => {
  const { complaint, distanceMeters, relationType } = item;
  const [supporting, setSupporting] = useState(false);
  const [supportCount, setSupportCount] = useState(complaint.support_count || 1);
  const [hasSupported, setHasSupported] = useState(false);

  const handleSupport = async () => {
    if (hasSupported) return;
    setSupporting(true);
    try {
      const newCount = await supportDuplicateComplaint(complaint.id);
      setSupportCount(newCount);
      setHasSupported(true);
      if (onSupportUpdated) onSupportUpdated();
    } catch (e) {
      console.error(e);
    } finally {
      setSupporting(false);
    }
  };

  const tagStyle = relationType === 'Duplicate Candidate'
    ? 'bg-rose-50 text-rose-800 border-rose-200'
    : relationType === 'Similar Issue'
    ? 'bg-amber-50 text-amber-800 border-amber-200'
    : 'bg-blue-50 text-blue-800 border-blue-200';

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm hover:border-emerald-500 transition-all flex flex-col justify-between space-y-3 font-sans">
      
      <div className="space-y-3">
        {/* HEADER BADGE & DISTANCE */}
        <div className="flex items-center justify-between text-xs">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider font-mono ${tagStyle}`}>
            {relationType}
          </span>
          <span className="font-mono text-[11px] font-bold text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-200 flex items-center space-x-1">
            <MapPin className="w-3 h-3 text-emerald-600" />
            <span>{distanceMeters}m away</span>
          </span>
        </div>

        {/* IMAGE & STATUS */}
        <div className="relative rounded-xl overflow-hidden h-32 bg-gray-100 border border-gray-200">
          {complaint.photo_before_url ? (
            <img
              src={complaint.photo_before_url}
              alt={complaint.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400 space-y-1">
              <span className="text-[10px] font-semibold text-gray-400">No image available</span>
            </div>
          )}
          <div className="absolute top-2 left-2">
            <StatusBadge status={complaint.status} />
          </div>
        </div>

        {/* TITLE & PUBLIC ID */}
        <div>
          <span className="font-mono text-[10px] font-bold text-emerald-700 block">
            ID: {complaint.complaint_number}
          </span>
          <h4 className="text-sm font-extrabold text-gray-900 leading-snug line-clamp-1 font-outfit">
            {complaint.title}
          </h4>
          <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{complaint.description}</p>
        </div>

        {/* METADATA (PUBLIC SAFE ONLY) */}
        <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-[11px] space-y-1">
          <div className="flex items-center justify-between text-gray-600">
            <span>Department:</span>
            <span className="font-semibold text-gray-900">{complaint.department_name || 'Public Works'}</span>
          </div>
          <div className="flex items-center justify-between text-gray-600">
            <span>Community Support:</span>
            <span className="font-mono font-bold text-emerald-700">{supportCount} Citizen(s)</span>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 text-xs">
        <button
          onClick={handleSupport}
          disabled={supporting || hasSupported}
          className={`px-3 py-1.5 rounded-xl font-bold border transition-colors flex items-center space-x-1 min-h-[44px] ${
            hasSupported
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : 'bg-white hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 border-gray-200'
          }`}
        >
          <ThumbsUp className={`w-3.5 h-3.5 ${hasSupported ? 'fill-emerald-600 text-emerald-600' : ''}`} />
          <span>{hasSupported ? 'Supported' : 'Support Issue'}</span>
        </button>

        <Link
          to={`/citizen/complaint/${complaint.id}`}
          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] uppercase tracking-wider shadow-sm flex items-center space-x-1 min-h-[44px]"
        >
          <span>View Issue</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

    </div>
  );
};
