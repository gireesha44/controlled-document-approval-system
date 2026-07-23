'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle,
  XCircle,
  Send,
  Upload,
  Archive,
  Clock,
  User,
  Shield,
  RefreshCw,
  Plus,
  AlertTriangle,
  Lock,
  Layers,
  History,
  AlertCircle,
  Eye,
  Edit3,
} from 'lucide-react';

interface SeededUser {
  id: string;
  name: string;
  email: string;
  role: 'author' | 'reviewer' | 'admin' | 'viewer';
}

const SEEDED_USERS: SeededUser[] = [
  { id: 'usr_alice', name: 'Alice Johnson', email: 'alice@example.com', role: 'author' },
  { id: 'usr_bob', name: 'Bob Smith', email: 'bob@example.com', role: 'reviewer' },
  { id: 'usr_admin', name: 'System Admin', email: 'admin@example.com', role: 'admin' },
  { id: 'usr_viewer', name: 'Valerie Viewer', email: 'viewer@example.com', role: 'viewer' },
];

interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  comment?: string | null;
  timestamp: string;
}

interface DocumentItem {
  id: string;
  title: string;
  body: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'published' | 'archived';
  authorId: string;
  authorName?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  auditLogs?: AuditLog[];
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<SeededUser>(SEEDED_USERS[0]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [filterTab, setFilterTab] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Modals & Form states
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newBody, setNewBody] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editBody, setEditBody] = useState<string>('');
  const [rejectComment, setRejectComment] = useState<string>('');
  const [showRejectInput, setShowRejectInput] = useState<boolean>(false);

  // Fetch documents on load & user change
  useEffect(() => {
    fetchDocuments();
  }, [currentUser]);

  // Fetch selected doc detail when selection changes
  useEffect(() => {
    if (selectedDocId) {
      fetchDocumentDetail(selectedDocId);
    } else {
      setSelectedDoc(null);
    }
  }, [selectedDocId, currentUser]);

  const fetchDocuments = async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/documents', {
        headers: { 'x-user-id': currentUser.id },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch documents');
      setDocuments(data.documents);
      if (data.documents.length > 0 && !selectedDocId) {
        setSelectedDocId(data.documents[0].id);
      }
    } catch (err: any) {
      setErrorBanner(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`, {
        headers: { 'x-user-id': currentUser.id },
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error);
        setSelectedDoc(null);
        return;
      }
      setSelectedDoc(data.document);
      setEditTitle(data.document.title);
      setEditBody(data.document.body);
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ title: newTitle, body: newBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setSuccessBanner('Draft document created successfully.');
      setShowCreateModal(false);
      setNewTitle('');
      setNewBody('');
      await fetchDocuments();
      setSelectedDocId(data.document.id);
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  const handleDocumentAction = async (
    action: 'edit' | 'submit' | 'review' | 'publish' | 'archive',
    payload: { decision?: 'approve' | 'reject'; comment?: string; forcedVersion?: number } = {}
  ) => {
    if (!selectedDoc) return;
    setErrorBanner(null);
    setSuccessBanner(null);

    const versionToUse = payload.forcedVersion !== undefined ? payload.forcedVersion : selectedDoc.version;

    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({
          title: editTitle,
          body: editBody,
          decision: payload.decision,
          comment: payload.comment,
          expectedVersion: versionToUse,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessBanner(`Action '${action}' completed successfully.`);
      setIsEditing(false);
      setShowRejectInput(false);
      setRejectComment('');
      await fetchDocuments();
      fetchDocumentDetail(selectedDoc.id);
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  const handleResetDatabase = async () => {
    if (!confirm('Are you sure you want to reset the database to initial seeded state?')) return;
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      setSuccessBanner('Database reset to initial seed state.');
      setSelectedDocId(null);
      await fetchDocuments();
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  const filteredDocs = documents.filter((doc) => {
    if (filterTab === 'all') return true;
    return doc.status === filterTab;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider">Draft</span>;
      case 'submitted':
        return <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider">Submitted</span>;
      case 'approved':
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider">Approved</span>;
      case 'rejected':
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider">Rejected</span>;
      case 'published':
        return <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider">Published</span>;
      case 'archived':
        return <span className="bg-slate-500/10 text-slate-400 border border-slate-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider">Archived</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Header & User Quick Switcher */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                ElevateBox
                <span className="text-xs px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">Controlled Doc Approval System</span>
              </h1>
              <p className="text-xs text-slate-400">Strict State Machine · OCC Concurrency · Server-Enforced Rules · Atomic Auditing</p>
            </div>
          </div>

          {/* Seeded User Switcher */}
          <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium px-2 flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Identity:
            </span>
            <div className="flex space-x-1">
              {SEEDED_USERS.map((user) => {
                const active = currentUser.id === user.id;
                return (
                  <button
                    key={user.id}
                    onClick={() => {
                      setCurrentUser(user);
                      setIsEditing(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                      active
                        ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span>{user.name.split(' ')[0]}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded uppercase font-semibold ${
                      user.role === 'admin' ? 'bg-amber-900/60 text-amber-300' :
                      user.role === 'reviewer' ? 'bg-indigo-900/60 text-indigo-300' :
                      user.role === 'author' ? 'bg-sky-900/60 text-sky-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {user.role}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleResetDatabase}
            title="Reset DB to initial seed state"
            className="text-xs text-slate-400 hover:text-rose-400 p-2 rounded-lg hover:bg-slate-800 transition flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset DB</span>
          </button>
        </div>
      </header>

      {/* Main Banner: State Machine Visual Guide */}
      <div className="bg-slate-900/40 border-b border-slate-800/60 py-3 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center space-x-2 font-mono">
            <span className="font-semibold text-slate-300 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-sky-400" /> Document Workflow State Machine:
            </span>
          </div>
          <div className="flex items-center space-x-2 font-mono text-[11px]">
            <span className={`px-2 py-0.5 rounded ${selectedDoc?.status === 'draft' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>draft</span>
            <span>→</span>
            <span className={`px-2 py-0.5 rounded ${selectedDoc?.status === 'submitted' ? 'bg-sky-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>submitted</span>
            <span>→</span>
            <span className={`px-2 py-0.5 rounded ${selectedDoc?.status === 'approved' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>approved</span>
            <span>→</span>
            <span className={`px-2 py-0.5 rounded ${selectedDoc?.status === 'published' ? 'bg-indigo-500 text-white font-bold ring-2 ring-indigo-400' : 'bg-slate-800 text-slate-400'}`}>published (Public)</span>
            <span className="text-slate-600">|</span>
            <span className={`px-2 py-0.5 rounded ${selectedDoc?.status === 'rejected' ? 'bg-rose-500 text-white font-bold' : 'bg-slate-800 text-slate-400'}`}>rejected</span>
            <span>→</span>
            <span className="text-slate-400">draft</span>
            <span className="text-slate-600">|</span>
            <span className={`px-2 py-0.5 rounded ${selectedDoc?.status === 'archived' ? 'bg-slate-600 text-white font-bold' : 'bg-slate-800 text-slate-400'}`}>archived</span>
          </div>
        </div>
      </div>

      {/* Dynamic Alerts */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-4 space-y-2">
        {errorBanner && (
          <div className="bg-rose-950/80 border border-rose-800/80 text-rose-200 px-4 py-3 rounded-xl flex items-start gap-3 shadow-lg text-sm">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block text-rose-300">Server Validation / Rule Exception</span>
              <span>{errorBanner}</span>
            </div>
            <button onClick={() => setErrorBanner(null)} className="text-rose-400 hover:text-white text-xs">Dismiss</button>
          </div>
        )}

        {successBanner && (
          <div className="bg-emerald-950/80 border border-emerald-800/80 text-emerald-200 px-4 py-2.5 rounded-xl flex items-center gap-3 text-sm">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="flex-1">{successBanner}</span>
            <button onClick={() => setSuccessBanner(null)} className="text-emerald-400 hover:text-white text-xs">Dismiss</button>
          </div>
        )}
      </div>

      {/* Main Workspace Layout */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Document List & Tabs */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" /> Documents
              <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                {filteredDocs.length}
              </span>
            </h2>

            {currentUser.role === 'author' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> New Draft
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex overflow-x-auto space-x-1 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            {['all', 'draft', 'submitted', 'approved', 'published', 'archived'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`px-2.5 py-1 rounded-lg capitalize whitespace-nowrap transition font-medium ${
                  filterTab === tab ? 'bg-slate-800 text-sky-400 font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Documents Scroll Area */}
          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading documents...</div>
            ) : filteredDocs.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
                No documents found matching filter '{filterTab}'.
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const isSelected = doc.id === selectedDocId;
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      setSelectedDocId(doc.id);
                      setIsEditing(false);
                    }}
                    className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between space-y-2.5 ${
                      isSelected
                        ? 'bg-slate-900 border-sky-500/60 ring-1 ring-sky-500/40 shadow-lg'
                        : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm text-slate-100 line-clamp-1">{doc.title}</h3>
                      {getStatusBadge(doc.status)}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{doc.body}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
                      <span>Ver: <strong className="text-slate-300 font-mono">v{doc.version}</strong></span>
                      <span>{new Date(doc.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Document Inspector & Audit History */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          {selectedDoc ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col space-y-5 shadow-xl">

              {/* Document Header & State Actions */}
              <div className="flex flex-col space-y-3 pb-4 border-b border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] text-slate-400 font-mono block">ID: {selectedDoc.id}</span>
                    <h2 className="text-xl font-bold text-white tracking-tight">{selectedDoc.title}</h2>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-lg font-mono">
                      v{selectedDoc.version}
                    </span>
                    {getStatusBadge(selectedDoc.status)}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center space-x-3">
                    <span>Author: <strong className="text-slate-200">{selectedDoc.authorName || selectedDoc.authorId}</strong></span>
                    <span>•</span>
                    <span>Created: {new Date(selectedDoc.createdAt).toLocaleDateString()}</span>
                  </div>

                  {/* OCC Simulation Test Button */}
                  <button
                    onClick={() => {
                      if (confirm('Simulate Stale Client Write? This passes version - 1 to server to verify OCC error response.')) {
                        handleDocumentAction('edit', { forcedVersion: selectedDoc.version - 1 });
                      }
                    }}
                    title="Test Optimistic Concurrency Control failure response"
                    className="text-[11px] text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg flex items-center gap-1 transition"
                  >
                    <AlertCircle className="w-3 h-3" /> Simulate OCC Conflict
                  </button>
                </div>
              </div>

              {/* Server-Side Rule Warnings for Current User Context */}
              {currentUser.role === 'reviewer' && selectedDoc.authorId === currentUser.id && selectedDoc.status === 'submitted' && (
                <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span><strong>Server Authorization Rule:</strong> You are the author of this document. Even with your Reviewer role, the server strictly forbids approving your own document.</span>
                </div>
              )}

              {currentUser.role === 'viewer' && (
                <div className="bg-indigo-950/40 border border-indigo-800/60 p-2.5 rounded-xl text-xs text-indigo-300 flex items-center gap-2">
                  <Eye className="w-4 h-4 shrink-0 text-indigo-400" />
                  <span><strong>Viewer Mode:</strong> You are viewing published content. All write actions are blocked on server.</span>
                </div>
              )}

              {/* Document Body / Editor */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <span>Document Content</span>
                  {currentUser.role === 'author' && selectedDoc.authorId === currentUser.id && (selectedDoc.status === 'draft' || selectedDoc.status === 'rejected') && !isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-sky-400 hover:text-sky-300 flex items-center gap-1 text-xs capitalize normal-case font-normal"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Content
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-sky-500/50">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Title</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Body</label>
                      <textarea
                        rows={5}
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div className="flex justify-end space-x-2 pt-2">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDocumentAction('edit')}
                        className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold"
                      >
                        Save Draft Edit
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 min-h-[120px] text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {selectedDoc.body}
                  </div>
                )}
              </div>

              {/* Action Toolbar (Role & State Contextual) */}
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-400 font-medium">
                  Allowed Actions ({currentUser.role}):
                </div>

                <div className="flex items-center space-x-2">
                  {/* Submit Action (Author only on draft or rejected) */}
                  {currentUser.role === 'author' && selectedDoc.authorId === currentUser.id && (selectedDoc.status === 'draft' || selectedDoc.status === 'rejected') && (
                    <button
                      onClick={() => handleDocumentAction('submit')}
                      className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition"
                    >
                      <Send className="w-3.5 h-3.5" /> Submit for Review
                    </button>
                  )}

                  {/* Review Actions (Reviewer/Admin on submitted) */}
                  {(currentUser.role === 'reviewer' || currentUser.role === 'admin') && selectedDoc.status === 'submitted' && (
                    <>
                      <button
                        onClick={() => handleDocumentAction('review', { decision: 'approve' })}
                        disabled={selectedDoc.authorId === currentUser.id}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md transition"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>

                      <button
                        onClick={() => setShowRejectInput(!showRejectInput)}
                        disabled={selectedDoc.authorId === currentUser.id}
                        className="bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md transition"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject...
                      </button>
                    </>
                  )}

                  {/* Publish Action (Reviewer/Admin on approved) */}
                  {(currentUser.role === 'reviewer' || currentUser.role === 'admin') && selectedDoc.status === 'approved' && (
                    <button
                      onClick={() => handleDocumentAction('publish')}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition"
                    >
                      <Upload className="w-3.5 h-3.5" /> Publish Document
                    </button>
                  )}

                  {/* Archive Action (Admin on active states) */}
                  {currentUser.role === 'admin' && selectedDoc.status !== 'archived' && (
                    <button
                      onClick={() => handleDocumentAction('archive')}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition border border-slate-700"
                    >
                      <Archive className="w-3.5 h-3.5" /> Archive
                    </button>
                  )}
                </div>
              </div>

              {/* Rejection Comment Input Box */}
              {showRejectInput && (
                <div className="bg-rose-950/50 border border-rose-800/80 p-3 rounded-xl space-y-2">
                  <label className="text-xs font-semibold text-rose-300 block">Rejection Comment (Required by Server Rule)</label>
                  <input
                    type="text"
                    placeholder="State reason for rejection..."
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                    className="w-full bg-slate-900 border border-rose-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setShowRejectInput(false)}
                      className="text-xs text-slate-400 hover:text-white px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDocumentAction('review', { decision: 'reject', comment: rejectComment })}
                      className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-3 py-1 rounded-lg"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}

              {/* Audit History Log Timeline (Story 7) */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-sky-400" /> Audit Log History (Atomic Database Transactions)
                </h3>

                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {selectedDoc.auditLogs && selectedDoc.auditLogs.length > 0 ? (
                    selectedDoc.auditLogs.map((log) => (
                      <div key={log.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800/60 flex items-start justify-between text-xs gap-3">
                        <div className="flex items-start space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 font-bold shrink-0 mt-0.5">
                            {log.action[0]}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-slate-200">{log.action}</span>
                              <span className="text-[10px] text-slate-400 font-mono">by {log.actorName} ({log.actorRole})</span>
                            </div>
                            {log.comment && <p className="text-slate-400 text-xs mt-0.5 italic">"{log.comment}"</p>}
                            {log.previousStatus && log.newStatus && (
                              <span className="text-[10px] text-slate-500 font-mono block mt-1">
                                {log.previousStatus} → {log.newStatus}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500 whitespace-nowrap font-mono">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No audit records found.</p>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
              <FileText className="w-12 h-12 text-slate-700 stroke-[1.5]" />
              <p className="text-sm">Select a document from the list to view details and audit logs.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Document */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" /> Create New Draft Document
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateDocument} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Security & Compliance Policy 2026"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Body Content</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Enter detailed document content..."
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs px-5 py-2 rounded-xl shadow-lg shadow-sky-600/30"
                >
                  Create Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
