import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { LocationMapPicker } from '../../components/LocationMapPicker';
import { resolveIssueLocation, findDuplicateComplaints, isWithinNashikServiceArea } from '../../services/locationService';
import {
  detectCivicIssue,
  extractVisualFeatures,
  compareImageSimilarity,
  checkAiHealth,
  CIVIC_CATEGORIES,
  CivicCategory
} from '../../services/aiVisionService';
import { createComplaint, generateComplaintNumber, saveOfflineDraft, getStoredComplaints } from '../../services/complaintService';
import { PriorityLevel, AIVisionResult, VisualFeatures, ImageSimilarityResult } from '../../types/database.types';
import {
  Camera, Upload, Sparkles, AlertTriangle, CheckCircle2, MapPin,
  ArrowRight, ArrowLeft, RefreshCw, ShieldCheck, WifiOff, FileText, X, Edit3, Save, ThumbsUp, Plus, Image as ImageIcon, Eye
} from 'lucide-react';

interface AdditionalPhotoItem {
  id: string;
  file?: File;
  previewUrl: string;
  features: VisualFeatures;
  similarity: ImageSimilarityResult;
}

export const ReportIssuePage: React.FC = () => {
  const { user } = useAuth();
  const { t, translateCategory, translatePriority, translateDepartment } = useLanguage();
  const navigate = useNavigate();

  // Primary Photo & EXIF State
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>('');
  const [primaryFeatures, setPrimaryFeatures] = useState<VisualFeatures | null>(null);

  // Additional Evidence / Angles (Max 4 additional photos)
  const [additionalPhotos, setAdditionalPhotos] = useState<AdditionalPhotoItem[]>([]);
  const [analyzingAngle, setAnalyzingAngle] = useState(false);
  const [angleErrorMsg, setAngleErrorMsg] = useState<string | null>(null);

  // Location Priority State (Default: Nashik City Center)
  const [lat, setLat] = useState<number>(20.0059);
  const [lng, setLng] = useState<number>(73.7898);
  const [locationSource, setLocationSource] = useState<'live_gps' | 'exif_gps' | 'manual_pin' | 'geocoded' | 'geocode_failed' | 'unavailable' | 'gps'>('manual_pin');
  const [locationAddress, setLocationAddress] = useState<string>('Panchavati Main Road, Nashik City');
  const [showLocationPickerModal, setShowLocationPickerModal] = useState(false);

  // AI Vision Analysis State
  const [analyzingAI, setAnalyzingAI] = useState(false);
  const [aiResult, setAiResult] = useState<AIVisionResult | null>(null);
  const [isManuallyEdited, setIsManuallyEdited] = useState(false);
  const [aiHealth, setAiHealth] = useState<{ configured: boolean; model: string; reachable: boolean; error?: string | null } | null>(null);

  React.useEffect(() => {
    checkAiHealth().then((res) => {
      setAiHealth(res);
    });
  }, []);

  // Citizen Editable Fields
  const [category, setCategory] = useState<CivicCategory>('Road Damage / Pothole');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [priority, setPriority] = useState<PriorityLevel>('High');
  const [department, setDepartment] = useState<string>('Roads & Public Works Department (PWD)');

  // 100m Duplicate Check State
  const [nearbyDuplicates, setNearbyDuplicates] = useState<any[]>([]);

  // Modal Review & Submission State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftSavedToast, setDraftSavedToast] = useState(false);

  // Handle Primary Photo Upload / Capture
  const handlePhotoSelect = async (file: File) => {
    // 1. Clear previous photo & AI state immediately
    setSelectedPhotoFile(file);
    setAiResult(null);
    setIsManuallyEdited(false);
    setPrimaryFeatures(null);
    setCategory('Road Damage / Pothole');
    setTitle('');
    setDescription('');
    setPriority('High');
    setDepartment('Public Works Department (PWD)');

    const url = URL.createObjectURL(file);
    setPhotoPreviewUrl(url);
    await runAIVisionAndLocation(file, url);
  };

  const runAIVisionAndLocation = async (file: File, url: string) => {
    setAnalyzingAI(true);

    let liveLat: number | null = null;
    let liveLng: number | null = null;

    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
        });
        liveLat = pos.coords.latitude;
        liveLng = pos.coords.longitude;
      } catch (e) {
        console.log('Live GPS timeout/denied');
      }
    }

    const locResult = await resolveIssueLocation(file, liveLat, liveLng);
    if (locResult.latitude && locResult.longitude) {
      if (isWithinNashikServiceArea(locResult.latitude, locResult.longitude)) {
        setLat(locResult.latitude);
        setLng(locResult.longitude);
        setLocationSource(locResult.source);
        runDuplicateCheck(locResult.latitude, locResult.longitude);
      } else {
        setLat(20.0059);
        setLng(73.7898);
        setLocationSource('manual_pin');
        runDuplicateCheck(20.0059, 73.7898);
      }
    }

    try {
      // Pass actual uploaded File object to detectCivicIssue
      const res = await detectCivicIssue(file);
      setAiResult(res);
      setPrimaryFeatures(res.visual_features || null);
      if (res.category) setCategory(res.category as CivicCategory);
      if (res.title) setTitle(res.title);
      if (res.description) setDescription(res.description);
      if (res.priority) setPriority(res.priority);
      if (res.department) setDepartment(res.department);
    } catch (err) {
      console.error('AI Vision Error:', err);
    } finally {
      setAnalyzingAI(false);
    }
  };

  // Handle Additional Photo Upload / Different Angle Analysis
  const handleAdditionalPhotoSelect = async (file: File) => {
    if (additionalPhotos.length >= 4) {
      alert('Maximum of 5 photos (1 primary + 4 additional angles) allowed per complaint.');
      return;
    }

    setAnalyzingAngle(true);
    setAngleErrorMsg(null);

    try {
      const angleUrl = URL.createObjectURL(file);
      const angleFeatures = await extractVisualFeatures(file);

      // Compare against primary photo
      if (primaryFeatures) {
        const similarity = compareImageSimilarity(primaryFeatures, angleFeatures, 0);

        if (similarity.isExactDuplicate) {
          setAngleErrorMsg('Exact duplicate image detected! This exact photo has already been uploaded.');
          setAnalyzingAngle(false);
          return;
        }

        const newPhotoItem: AdditionalPhotoItem = {
          id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          file,
          previewUrl: angleUrl,
          features: angleFeatures,
          similarity
        };

        setAdditionalPhotos((prev) => [...prev, newPhotoItem]);
      } else {
        const newPhotoItem: AdditionalPhotoItem = {
          id: `photo-${Date.now()}`,
          file,
          previewUrl: angleUrl,
          features: angleFeatures,
          similarity: {
            isExactDuplicate: false,
            similarityScore: 0.85,
            confidenceLevel: 'High',
            relation: 'same_issue_different_angle',
            reason: 'Additional visual evidence attached.'
          }
        };
        setAdditionalPhotos((prev) => [...prev, newPhotoItem]);
      }
    } catch (err) {
      console.error('Angle analysis error:', err);
      setAngleErrorMsg('Failed to process additional angle image.');
    } finally {
      setAnalyzingAngle(false);
    }
  };

  const removeAdditionalPhoto = (id: string) => {
    setAdditionalPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const runDuplicateCheck = (checkLat: number, checkLng: number) => {
    const existing = getStoredComplaints();
    const dups = findDuplicateComplaints(checkLat, checkLng, existing, 100);
    setNearbyDuplicates(dups);
  };

  const handleSaveDraft = () => {
    saveOfflineDraft({
      category, title, description, priority, department, lat, lng, locationAddress, photoPreviewUrl
    });
    setDraftSavedToast(true);
    setTimeout(() => setDraftSavedToast(false), 3000);
  };

  // Final Complaint Submission
  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      const complaintNumber = generateComplaintNumber();
      const additionalUrls = additionalPhotos.map((p) => p.previewUrl);

      const newComplaintData = {
        complaint_number: complaintNumber,
        citizen_id: user?.id || '',
        photo_before_url: photoPreviewUrl,
        additional_photos: additionalUrls,
        ai_vision_metadata: aiResult ? {
          category: aiResult.category,
          confidence: aiResult.confidence,
          confidence_level: aiResult.confidence_level,
          detected_objects: aiResult.detected_objects,
          analysis_time_ms: aiResult.analysis_time_ms,
          additional_angles_count: additionalPhotos.length
        } : undefined,
        category,
        title: title || `${category} Issue Reported`,
        description: description || `Civic issue reported via NAGARSETU 3.0 at ${locationAddress}`,
        priority,
        status: 'Submitted' as const,
        department_name: department,
        latitude: lat,
        longitude: lng,
        location_source: locationSource,
        location_address: locationAddress
      };

      const created = await createComplaint(newComplaintData);
      setShowReviewModal(false);
      navigate('/citizen/success', { state: { complaint: created } });
    } catch (err) {
      console.error(err);
      saveOfflineDraft({
        category, title, description, priority, department, lat, lng, locationAddress, photoPreviewUrl
      });
      alert('Network issue detected. Complaint saved to offline drafts on your device.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Report Civic Issue">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 font-sans">
        
        {/* HEADER BAR */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Link to="/citizen/portal" className="text-xs font-bold text-emerald-700 hover:underline flex items-center space-x-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Dashboard</span>
              </Link>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit">
              Report Civic Issue
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              Upload photos and provide details of the civic defect. AI Vision automatically classifies the issue.
            </p>
          </div>

          <div className={`flex items-center space-x-2 text-xs font-mono font-bold px-3.5 py-2 rounded-full border ${
            aiHealth?.reachable
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : 'text-rose-700 bg-rose-50 border-rose-200'
          }`}>
            <Sparkles className={`w-4 h-4 ${aiHealth?.reachable ? 'text-emerald-600 animate-pulse' : 'text-rose-600'}`} />
            <span>
              {aiHealth?.reachable
                ? `🟢 Gemini Vision Active (${aiHealth.model})`
                : aiHealth?.configured
                ? '🔴 AI Vision Offline (API Unreachable)'
                : '🔴 AI Key Not Configured'}
            </span>
          </div>
        </div>

        {/* DRAFT SAVED TOAST */}
        {draftSavedToast && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center space-x-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>✓ Complaint draft saved offline to your device.</span>
          </div>
        )}

        {/* MAIN DESKTOP 50/50 SPLIT LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT 50% PANEL: IMAGE & AI ANALYSIS & LOCATION BADGE */}
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6 lg:sticky lg:top-20">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-sm font-extrabold text-gray-900 font-outfit uppercase tracking-wider">
                1. Civic Issue Photo Evidence
              </h2>
              {photoPreviewUrl && (
                <button
                  onClick={() => {
                    setPhotoPreviewUrl('');
                    setSelectedPhotoFile(null);
                    setPrimaryFeatures(null);
                    setAiResult(null);
                    setAdditionalPhotos([]);
                  }}
                  className="text-xs text-rose-600 font-bold hover:underline min-h-[44px]"
                >
                  Remove Photo
                </button>
              )}
            </div>

            {/* UPLOAD BOX OR LARGE PREVIEW */}
            {!photoPreviewUrl ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center bg-gray-50/50 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                    <Camera className="w-7 h-7" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-extrabold text-gray-900 font-outfit">Upload Primary Photo</h3>
                    <p className="text-xs text-gray-500">Take a photo or upload an image of the civic issue.</p>
                  </div>

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    capture="environment"
                    id="citizen-photo-upload"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handlePhotoSelect(e.target.files[0]);
                      }
                    }}
                  />

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <label
                      htmlFor="citizen-photo-upload"
                      className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider cursor-pointer shadow-sm min-h-[44px] flex items-center justify-center space-x-2"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Open Camera</span>
                    </label>

                    <label
                      htmlFor="citizen-photo-upload"
                      className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-gray-50 text-gray-800 font-extrabold text-xs uppercase tracking-wider cursor-pointer border border-gray-300 shadow-xs min-h-[44px] flex items-center justify-center space-x-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload Image</span>
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              /* LARGE PREVIEW IMAGE (ASPECT 4/3) */
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden border border-gray-200 aspect-4/3 bg-gray-100">
                  <img src={photoPreviewUrl} alt="Civic Issue" className="w-full h-full object-cover" />
                  {analyzingAI && (
                    <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2 font-outfit text-xs font-extrabold">
                      <Sparkles className="w-6 h-6 animate-spin text-emerald-400" />
                      <span>AI Vision Analyzing Visual Evidence...</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <label
                    htmlFor="citizen-photo-upload"
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs text-center border border-gray-300 cursor-pointer min-h-[44px] flex items-center justify-center space-x-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Replace Primary Photo</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setPhotoPreviewUrl('');
                      setSelectedPhotoFile(null);
                      setPrimaryFeatures(null);
                      setAiResult(null);
                      setAdditionalPhotos([]);
                      setTitle('');
                      setDescription('');
                      setIsManuallyEdited(false);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 min-h-[44px]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            {/* AI ANALYSIS RESULT CARD */}
            {aiResult && aiResult.confidence === 0 ? (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-rose-900 font-outfit uppercase tracking-wider flex items-center space-x-1">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>AI Vision Analysis Failed</span>
                  </span>
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded border text-rose-800 bg-white border-rose-200">
                    Status: Analysis Unavailable
                  </span>
                </div>

                <p className="text-rose-900 font-medium text-xs">
                  {aiResult.description || 'AI service unavailable. Please review photo and fill complaint details manually.'}
                </p>

                {selectedPhotoFile && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedPhotoFile) runAIVisionAndLocation(selectedPhotoFile, photoPreviewUrl);
                    }}
                    className="w-full py-2.5 rounded-xl bg-white hover:bg-rose-100 text-rose-800 font-bold border border-rose-300 flex items-center justify-center space-x-1 min-h-[44px]"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-rose-600" />
                    <span>Retry AI Analysis</span>
                  </button>
                )}
              </div>
            ) : aiResult && (
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-300 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-emerald-900 font-outfit uppercase tracking-wider flex items-center space-x-1">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>AI Vision Analysis Result</span>
                  </span>

                  <span
                    className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${
                      aiResult.confidence_level === 'High'
                        ? 'text-emerald-800 bg-white border-emerald-200'
                        : aiResult.confidence_level === 'Medium'
                        ? 'text-amber-800 bg-amber-50 border-amber-200'
                        : 'text-rose-800 bg-rose-50 border-rose-200'
                    }`}
                  >
                    {aiResult.confidence_level === 'High' ? '🟢 High Confidence' : aiResult.confidence_level === 'Medium' ? '🟡 Please Verify' : '⚪ Low Confidence'} ({Math.round(aiResult.confidence * 100)}%)
                  </span>
                </div>

                {/* Quality Warning if any */}
                {aiResult.quality_check?.warning && (
                  <div className="p-2.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-medium flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>{aiResult.quality_check.warning}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-gray-800 pt-1 font-medium">
                  <div>
                    <span className="text-gray-500 block text-[10px]">Detected Category:</span>
                    <strong className="text-emerald-900 font-outfit text-sm">✓ {aiResult.category}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Recommended Department:</span>
                    <strong className="text-gray-900 text-xs truncate block">{aiResult.department}</strong>
                  </div>
                </div>

                {aiResult.detected_objects && aiResult.detected_objects.length > 0 && (
                  <div className="pt-1 border-t border-emerald-200/60 flex flex-wrap gap-1 items-center">
                    <span className="text-[10px] text-gray-500 mr-1">Detected Features:</span>
                    {aiResult.detected_objects.map((obj) => (
                      <span key={obj} className="px-1.5 py-0.5 bg-white rounded border border-emerald-200 text-[10px] font-mono text-emerald-800">
                        #{obj}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ADDITIONAL EVIDENCE / DIFFERENT ANGLE UPLOADS */}
            {photoPreviewUrl && (
              <div className="p-4 bg-slate-50 rounded-xl border border-gray-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span className="font-extrabold text-gray-900 font-outfit">Additional Angles & Evidence ({additionalPhotos.length}/4)</span>
                  </div>

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    capture="environment"
                    id="additional-angle-upload"
                    className="hidden"
                    disabled={additionalPhotos.length >= 4 || analyzingAngle}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleAdditionalPhotoSelect(e.target.files[0]);
                      }
                    }}
                  />

                  {additionalPhotos.length < 4 && (
                    <label
                      htmlFor="additional-angle-upload"
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] cursor-pointer flex items-center space-x-1 min-h-[36px]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Angle</span>
                    </label>
                  )}
                </div>

                {angleErrorMsg && (
                  <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-medium flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>{angleErrorMsg}</span>
                  </div>
                )}

                {analyzingAngle && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>AI Visual Similarity Comparing New Angle...</span>
                  </div>
                )}

                {/* ADDITIONAL PHOTOS LIST & SIMILARITY BADGES */}
                {additionalPhotos.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {additionalPhotos.map((item, idx) => (
                      <div key={item.id} className="p-2.5 bg-white rounded-lg border border-gray-200 flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <img src={item.previewUrl} alt={`Angle ${idx + 1}`} className="w-12 h-12 rounded object-cover border border-gray-200 shrink-0" />
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-gray-900 text-xs">Angle #{idx + 1}</span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                                  item.similarity.relation === 'same_issue_different_angle'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : item.similarity.relation === 'same_category_different_issue'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {item.similarity.relation === 'same_issue_different_angle'
                                  ? '✓ Same Civic Issue'
                                  : item.similarity.relation === 'same_category_different_issue'
                                  ? 'ℹ Same Category'
                                  : '• Distinct View'}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 truncate max-w-xs">{item.similarity.reason}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeAdditionalPhoto(item.id)}
                          className="text-rose-600 hover:text-rose-800 text-xs font-bold px-2 py-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500 italic">
                    You can capture up to 4 additional vantage angles to provide stronger visual evidence.
                  </p>
                )}
              </div>
            )}

            {/* LOCATION CARD */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-gray-900 font-outfit flex items-center space-x-1">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span>📍 Complaint Location</span>
                </span>
                <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {locationSource === 'live_gps' ? 'Live GPS' : locationSource === 'exif_gps' ? 'Photo EXIF' : 'Manual Pin'}
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="font-bold text-gray-900 block">{locationAddress}</span>
                <span className="font-mono text-[10px] text-gray-500 block">
                  {lat.toFixed(4)}, {lng.toFixed(4)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowLocationPickerModal(true)}
                className="w-full mt-2 py-2 rounded-xl bg-white hover:bg-gray-100 text-gray-800 font-bold border border-gray-300 min-h-[44px] flex items-center justify-center space-x-1"
              >
                <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Edit Location Pin</span>
              </button>
            </div>

          </div>

          {/* RIGHT 50% PANEL: COMPLAINT DETAILS FORM & ACTIONS */}
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-sm font-extrabold text-gray-900 font-outfit uppercase tracking-wider">
                2. Complaint Details & Form
              </h2>
              {isManuallyEdited && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✓ Manually Edited
                </span>
              )}
            </div>

            {/* FORM FIELDS */}
            <div className="space-y-4 text-xs">
              
              <div>
                <label className="block font-bold text-gray-700 mb-1">{t('category')}</label>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value as CivicCategory);
                    setIsManuallyEdited(true);
                  }}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold text-gray-900 focus:border-emerald-500 min-h-[44px]"
                >
                  {CIVIC_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{translateCategory(c)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">{t('complaintTitle')}</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setIsManuallyEdited(true);
                  }}
                  placeholder={t('enterTitle')}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold text-gray-900 focus:border-emerald-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">{t('description')}</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setIsManuallyEdited(true);
                  }}
                  placeholder={t('enterDescription')}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-gray-900 focus:border-emerald-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">{t('priority')}</label>
                  <select
                    value={priority}
                    onChange={(e) => {
                      setPriority(e.target.value as PriorityLevel);
                      setIsManuallyEdited(true);
                    }}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold text-gray-900 focus:border-emerald-500 min-h-[44px]"
                  >
                    <option value="Low">{translatePriority('Low')}</option>
                    <option value="Medium">{translatePriority('Medium')}</option>
                    <option value="High">{translatePriority('High')}</option>
                    <option value="Critical">{translatePriority('Critical')}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">{t('myDepartment')}</label>
                  <select
                    value={department}
                    onChange={(e) => {
                      setDepartment(e.target.value);
                      setIsManuallyEdited(true);
                    }}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold text-gray-900 focus:border-emerald-500 min-h-[44px]"
                  >
                    <option value="Roads & Public Works Department (PWD)">{translateDepartment('Roads & Public Works Department (PWD)')}</option>
                    <option value="Sanitation & Solid Waste Management">{translateDepartment('Sanitation & Solid Waste Management')}</option>
                    <option value="Water Supply & Sewerage Board">{translateDepartment('Water Supply & Sewerage Board')}</option>
                    <option value="Electrical & Public Lighting Department">{translateDepartment('Electrical & Public Lighting Department')}</option>
                    <option value="Drainage & Sewerage Department">{translateDepartment('Drainage & Sewerage Department')}</option>
                    <option value="Traffic Engineering & Control Department">{translateDepartment('Traffic Engineering & Control Department')}</option>
                  </select>
                </div>
              </div>

            </div>

            {/* 100M NEARBY DUPLICATE CHECK */}
            <div className="pt-2 border-t border-gray-100">
              <span className="font-extrabold text-gray-900 font-outfit block text-xs mb-2">
                3. Nearby Complaint Check (100m Radius)
              </span>

              {nearbyDuplicates.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>✓ No similar complaint found nearby in the 100m radius.</span>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2 text-xs">
                  <div className="flex items-center space-x-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>⚠ Similar complaint found nearby ({nearbyDuplicates[0].distanceMeters}m away)</span>
                  </div>
                  <p className="text-amber-800 text-[11px]">An existing complaint for a similar issue was reported nearby.</p>
                  <div className="flex items-center space-x-2 pt-1">
                    <Link
                      to={`/citizen/complaint/${nearbyDuplicates[0].complaint.id}`}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 min-h-[44px] flex items-center"
                    >
                      View Existing
                    </Link>
                    <button
                      type="button"
                      onClick={() => alert(`Thank you! Your support for complaint ${nearbyDuplicates[0].complaint.complaint_number} has been recorded.`)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold text-xs hover:bg-amber-100 min-h-[44px]"
                    >
                      Support Existing
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* FORM ACTIONS */}
            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs border border-gray-300 min-h-[44px] flex items-center justify-center space-x-1.5"
              >
                <Save className="w-4 h-4 text-gray-600" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={() => setShowReviewModal(true)}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm min-h-[44px] flex items-center justify-center space-x-2 transition-all"
              >
                <span>Review Complaint ({additionalPhotos.length + 1} Photos)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* EDIT LOCATION MAP PICKER MODAL */}
      {showLocationPickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs font-sans">
          <div className="max-w-xl w-full bg-white rounded-2xl p-6 border border-gray-200 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 font-outfit">Adjust Site Location Pin</h3>
              <button onClick={() => setShowLocationPickerModal(false)} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px]">✕</button>
            </div>

            <div className="h-64 rounded-xl overflow-hidden border border-gray-200">
              <LocationMapPicker
                initialLat={lat}
                initialLng={lng}
                onLocationSelect={(newLat, newLng) => {
                  setLat(newLat);
                  setLng(newLng);
                  setLocationSource('manual_pin');
                  runDuplicateCheck(newLat, newLng);
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Landmark / Address Note</label>
              <input
                type="text"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs font-bold text-gray-900 min-h-[44px]"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowLocationPickerModal(false)}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold text-xs uppercase min-h-[44px]"
              >
                Confirm Location Pin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FINAL REVIEW & SUBMIT MODAL */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs font-sans">
          <div className="max-w-lg w-full bg-white rounded-2xl p-6 border border-gray-200 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 font-outfit">Review Complaint Before Submission</h3>
              <button onClick={() => setShowReviewModal(false)} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px]">✕</button>
            </div>

            {/* Photo Preview Strip */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1">
              {photoPreviewUrl && (
                <div className="h-28 w-36 shrink-0 rounded-xl overflow-hidden border border-gray-200 relative">
                  <img src={photoPreviewUrl} alt="Primary Preview" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 bg-gray-900/70 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">Primary</span>
                </div>
              )}

              {additionalPhotos.map((photo, idx) => (
                <div key={photo.id} className="h-28 w-36 shrink-0 rounded-xl overflow-hidden border border-gray-200 relative">
                  <img src={photo.previewUrl} alt={`Angle ${idx + 1}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 bg-emerald-900/80 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">Angle #{idx + 1}</span>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-800 font-outfit">Category: {category}</span>
                <span className="font-extrabold text-gray-900">Priority: {priority}</span>
              </div>

              <div>
                <strong className="block text-gray-900 font-outfit text-sm">{title || `${category} Issue`}</strong>
                <p className="text-gray-600 text-[11px] mt-0.5">{description || 'No description provided.'}</p>
              </div>

              <div className="pt-2 border-t border-gray-200 flex flex-wrap justify-between text-gray-500 text-[11px]">
                <span>Dept: {department}</span>
                <span>Address: {locationAddress}</span>
              </div>

              {aiResult && (
                <div className="pt-1.5 border-t border-gray-200 text-[10px] text-emerald-700 font-mono flex items-center space-x-1">
                  <Sparkles className="w-3 h-3" />
                  <span>AI Confidence: {Math.round(aiResult.confidence * 100)}% ({aiResult.confidence_level})</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs min-h-[44px]"
              >
                Edit Form
              </button>

              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase min-h-[44px] flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Submitting...' : 'Submit Complaint'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
};
