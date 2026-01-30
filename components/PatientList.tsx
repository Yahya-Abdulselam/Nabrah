'use client';

import { Patient, PatientStatus } from '@/lib/patientTypes';
import { PatientCard } from './PatientCard';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';

interface PatientListProps {
  patients: Patient[];
  statusFilter: PatientStatus | 'all';
  onFilterChange: (filter: PatientStatus | 'all') => void;
  onRefresh: () => void;
}

export function PatientList({
  patients,
  statusFilter,
  onFilterChange,
  onRefresh
}: PatientListProps) {
  const filters: Array<{ value: PatientStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'reviewing', label: 'In Review' },
    { value: 'completed', label: 'Completed' },
    { value: 'referred', label: 'Referred' }
  ];

  const filteredPatients = statusFilter === 'all'
    ? patients
    : patients.filter(p => p.status === statusFilter);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Button
            key={filter.value}
            variant={statusFilter === filter.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange(filter.value)}
          >
            {filter.label}
            {filter.value === 'all' && (
              <span className="ml-1 text-xs opacity-70">
                ({patients.length})
              </span>
            )}
            {filter.value !== 'all' && (
              <span className="ml-1 text-xs opacity-70">
                ({patients.filter(p => p.status === filter.value).length})
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Patient list */}
      {filteredPatients.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-600">
            No patients in queue
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {statusFilter === 'all'
              ? 'Start a triage check to add patients to the queue'
              : `No patients with status "${statusFilter}"`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPatients.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              onUpdate={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
