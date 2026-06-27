import Recorder from './components/Recorder.jsx';

export default function App() {
  return (
    <div className="min-h-screen bg-surface text-gray-100 flex flex-col">
      {/* Title bar area */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-surface2 select-none"
        style={{ WebkitAppRegion: 'drag' }}>
        <div className="w-3 h-3 rounded-full bg-indigo-500" />
        <span className="text-sm font-semibold text-gray-200 tracking-wide">GTT Screen Recorder</span>
        <span className="ml-auto text-xs text-gray-500">Desktop Edition</span>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <Recorder />
      </div>
    </div>
  );
}
