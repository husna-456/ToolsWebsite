import * as Icons from 'lucide-react';

export default function ToolIcon({ name, size = 'md', className = '' }) {
  const LucideIcon = Icons[name] || Icons.Wrench;
  const sizeMap = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };
  return <LucideIcon className={`${sizeMap[size]} ${className}`} strokeWidth={1.75} />;
}
