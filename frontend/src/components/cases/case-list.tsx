"use client"

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Plus, Scale } from 'lucide-react'
import Link from 'next/link'

interface Case {
  id: string
  name: string
  clientName: string
  createdAt: string
  lastModified: string
}

// Generate UUID
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Mock data for now
const mockCases: Case[] = [
  {
    id: 'a7b8c9d0-1234-4e5f-9abc-def012345678',
    name: 'Johnson v. Metro Transit',
    clientName: 'Sarah Johnson',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastModified: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'b1c2d3e4-5678-4f9a-bcde-f01234567890',
    name: 'Rodriguez Personal Injury',
    clientName: 'Carlos Rodriguez',
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    lastModified: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

export function CaseList() {
  const [cases, setCases] = useState<Case[]>(mockCases)

  const handleCreateCase = () => {
    const newCase: Case = {
      id: generateUUID(),
      name: `New Case ${cases.length + 1}`,
      clientName: 'New Client',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    }
    setCases([newCase, ...cases])
  }


  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-offblack">
          Cases
        </h1>
        <button
          onClick={handleCreateCase}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-true-turquoise text-white rounded-md hover:bg-telly-blue transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </div>

      {cases.length === 0 ? (
        <div className="text-center py-24">
          <Scale className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-400 mb-4">No cases</p>
          <button
            onClick={handleCreateCase}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-true-turquoise text-white rounded-md hover:bg-telly-blue transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Case
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {cases.map((caseItem) => (
            <Link
              key={caseItem.id}
              href={`/cases/${caseItem.id}`}
              className="group block"
            >
              <div className="flex items-center gap-4 px-4 py-3 rounded-lg border border-gray-200 bg-white hover:border-true-turquoise hover:bg-gray-50 transition-all">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-true-turquoise to-peacock flex items-center justify-center flex-shrink-0">
                  <Scale className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-offblack truncate group-hover:text-true-turquoise transition-colors">
                    {caseItem.name}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">
                    {caseItem.clientName}
                  </p>
                </div>
                <div className="text-xs text-gray-400 flex-shrink-0">
                  {formatDistanceToNow(new Date(caseItem.lastModified), {
                    addSuffix: true,
                  })}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
