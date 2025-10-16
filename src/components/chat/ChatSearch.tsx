/**
 * Chat Search Component - WhatsApp Style
 * Search messages in current chat with navigation
 */

import { useState, useEffect } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ChatSearchProps {
  messages: any[];
  onResultSelect: (messageId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const ChatSearch = ({ messages, onResultSelect, isOpen, onClose }: ChatSearchProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentResultIndex(0);
      return;
    }

    // Search in messages
    const query = searchQuery.toLowerCase();
    const results = messages.filter(msg => 
      !msg.is_system_message && 
      msg.content?.toLowerCase().includes(query)
    );

    setSearchResults(results);
    setCurrentResultIndex(results.length > 0 ? 0 : -1);

    // Highlight first result
    if (results.length > 0) {
      onResultSelect(results[0].id);
    }
  }, [searchQuery, messages]);

  const handleNext = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentResultIndex + 1) % searchResults.length;
    setCurrentResultIndex(nextIndex);
    onResultSelect(searchResults[nextIndex].id);
  };

  const handlePrevious = () => {
    if (searchResults.length === 0) return;
    const prevIndex = currentResultIndex === 0 ? searchResults.length - 1 : currentResultIndex - 1;
    setCurrentResultIndex(prevIndex);
    onResultSelect(searchResults[prevIndex].id);
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setCurrentResultIndex(0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="border-b bg-card px-4 py-3 flex items-center gap-2">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-4"
          autoFocus
        />
      </div>

      {/* Results Count */}
      {searchQuery && (
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          {searchResults.length > 0 ? (
            <span>
              {currentResultIndex + 1} of {searchResults.length}
            </span>
          ) : (
            <span>No results</span>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handlePrevious}
          disabled={searchResults.length === 0}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleNext}
          disabled={searchResults.length === 0}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleClose}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
