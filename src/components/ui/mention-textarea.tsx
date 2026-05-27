
"use client"

import * as React from "react"
import { Textarea } from "./textarea"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, limit, getDocs, doc, getDoc } from "firebase/firestore"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Loader2, User, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface MentionTextareaProps extends React.ComponentProps<typeof Textarea> {
  onValueChange?: (val: string) => void
}

export function MentionTextarea({ value, onValueChange, className, onChange, ...props }: MentionTextareaProps) {
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = React.useState("")
  const [suggestions, setSuggestions] = React.useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [cursorPos, setCursorPos] = React.useState(0)
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    const position = e.target.selectionStart
    setCursorPos(position)
    
    if (onChange) onChange(e)
    if (onValueChange) onValueChange(val)

    // Detectar gatilho @
    const textBeforeCursor = val.slice(0, position)
    const words = textBeforeCursor.split(/\s|\n/)
    const lastWord = words[words.length - 1]

    if (lastWord.startsWith("@") && lastWord.length > 1) {
      const term = lastWord.slice(1).toLowerCase()
      setSearchTerm(term)
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
    }
  }

  React.useEffect(() => {
    if (!showSuggestions || !searchTerm || !db) return

    const fetchSuggestions = async () => {
      setLoading(true)
      try {
        // Busca na coleção de usernames por prefixo
        const q = query(
          collection(db, "usernames"),
          where("__name__", ">=", searchTerm),
          where("__name__", "<=", searchTerm + "\uf8ff"),
          limit(5)
        )
        const snap = await getDocs(q)
        
        const results = await Promise.all(snap.docs.map(async (d) => {
          const data = d.data()
          const profileRef = doc(db, data.type === 'user' ? 'users' : 'organizations', data.uid)
          const profileSnap = await getDoc(profileRef)
          if (profileSnap.exists()) {
            const p = profileSnap.data()
            return {
              username: d.id,
              name: p.name || p.displayName,
              avatar: p.avatar,
              type: data.type
            }
          }
          return null
        }))
        
        setSuggestions(results.filter(Boolean))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(fetchSuggestions, 300)
    return () => clearTimeout(timer)
  }, [searchTerm, showSuggestions, db])

  const insertMention = (username: string) => {
    if (!textareaRef.current) return
    const val = textareaRef.current.value
    const textBefore = val.slice(0, cursorPos)
    const textAfter = val.slice(cursorPos)
    
    const words = textBefore.split(/\s|\n/)
    words[words.length - 1] = `@${username} `
    
    const newVal = words.join(" ") + textAfter
    if (onValueChange) onValueChange(newVal)
    
    setShowSuggestions(false)
    textareaRef.current.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % suggestions.length)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        insertMention(suggestions[selectedIndex].username)
      } else if (e.key === "Escape") {
        setShowSuggestions(false)
      }
    }
  }

  return (
    <div className="relative w-full">
      <Textarea
        {...props}
        ref={textareaRef}
        value={value}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        className={cn("resize-none", className)}
      />
      
      {showSuggestions && (
        <div className="absolute z-50 bottom-full left-0 mb-2 w-64 bg-white rounded-2xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom-2">
          <div className="p-2 bg-muted/30 border-b flex items-center justify-between">
            <span className="text-[10px] font-black uppercase opacity-40 px-2 tracking-widest">Sugestões</span>
            {loading && <Loader2 className="w-3 h-3 animate-spin opacity-40" />}
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {suggestions.length > 0 ? (
              suggestions.map((s, i) => (
                <button
                  key={s.username}
                  type="button"
                  onClick={() => insertMention(s.username)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-xl text-left transition-colors",
                    i === selectedIndex ? "bg-secondary/10 text-secondary" : "hover:bg-muted"
                  )}
                >
                  <Avatar className="h-8 w-8 border">
                    <AvatarImage src={s.avatar} className="object-cover" />
                    <AvatarFallback className="text-[10px]">{s.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate leading-tight">{s.name}</p>
                    <p className="text-[9px] font-medium opacity-50 truncate flex items-center gap-1">
                      {s.type === 'user' ? <User className="w-2.5 h-2.5" /> : <Building2 className="w-2.5 h-2.5" />}
                      @{s.username}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-[10px] font-bold text-muted-foreground uppercase opacity-40 italic">
                {loading ? "Buscando..." : "Nenhum resultado"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
