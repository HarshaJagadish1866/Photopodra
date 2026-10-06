import React from 'react';
import { Calendar, CheckCircle2 } from 'lucide-react';

/**
 * Formats a YYYY-MM-DD string into Google Photos style readable date:
 * e.g. "2026-10-04" -> "October 4, 2026"
 */
function formatGooglePhotosDate(dateStr) {
  if (!dateStr || dateStr === 'Undated') return { title: 'Undated', subtitle: 'No timestamp' };

  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dateObj = new Date(year, month, day);

      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      return {
        title: `${monthNames[month]} ${day}, ${year}`,
        subtitle: weekdayNames[dateObj.getDay()]
      };
    }

    const fallbackDate = new Date(dateStr);
    if (!isNaN(fallbackDate.getTime())) {
      return {
        title: fallbackDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        subtitle: fallbackDate.toLocaleDateString('en-US', { weekday: 'long' })
      };
    }
  } catch (err) {
    console.warn('Error formatting date:', err);
  }

  return { title: dateStr, subtitle: '' };
}

/**
 * StickyDateHeader component:
 * Floats and sticks to the top of the viewport when scrolling past groups,
 * matching Google Photos' native visual design.
 */
export default function StickyDateHeader({
  dateStr,
  count,
  isSelected = false,
  onSelectGroup
}) {
  const { title, subtitle } = formatGooglePhotosDate(dateStr);

  return (
    <div className="sticky top-[61px] z-20 py-2.5 px-4 mb-2 bg-slate-950/85 backdrop-blur-md border-b border-slate-900/80 transition-all flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <Calendar className="w-3.5 h-3.5" />
        </div>
        <div className="flex items-baseline gap-2">
          {/* Main date: e.g. "October 4, 2026" */}
          <h2 className="text-base font-semibold tracking-tight text-white">
            {title}
          </h2>
          {subtitle && (
            <span className="text-xs text-slate-400 font-medium">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="font-medium bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800 text-[11px]">
          {count} {count === 1 ? 'photo' : 'photos'}
        </span>

        {onSelectGroup && (
          <button
            onClick={() => onSelectGroup(dateStr)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            title="Select all photos from this day"
          >
            <CheckCircle2 className={`w-4 h-4 ${isSelected ? 'text-rose-400 fill-rose-500/20' : ''}`} />
          </button>
        )}
      </div>
    </div>
  );
}
