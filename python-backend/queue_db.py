"""
Queue Database Module

SQLite-based patient queue storage for the Nabrah clinical queue system.
Handles patient persistence, priority sorting, and queue management.
"""

import sqlite3
import json
import uuid
from datetime import datetime
from contextlib import contextmanager
from typing import Optional, List, Dict, Any

DB_PATH = "nabrah_queue.db"


@contextmanager
def get_db_connection():
    """Context manager for database connections."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """Initialize the database with required tables."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Create patients table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS patients (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,

                -- Triage result fields
                triage_level TEXT NOT NULL,
                triage_score INTEGER NOT NULL,
                triage_confidence INTEGER NOT NULL,
                triage_message TEXT,
                triage_action TEXT,

                -- Audio quality fields
                snr_db REAL,
                speech_percentage REAL,
                quality_is_reliable INTEGER,

                -- Whisper fields
                whisper_transcription TEXT,
                whisper_confidence REAL,
                whisper_avg_logprob REAL,

                -- WER fields
                wer_score REAL,
                wer_severity TEXT,

                -- Agreement fields
                agreement_percentage INTEGER,
                agreement_consensus TEXT,
                agreement_verdict TEXT,

                -- Detailed data (JSON)
                flags_json TEXT,
                detailed_flags_json TEXT,
                features_json TEXT,

                -- Queue management
                status TEXT DEFAULT 'pending',
                priority INTEGER NOT NULL,
                notes TEXT,
                reviewed_by TEXT,
                referred_to TEXT
            )
        ''')

        # Create index for efficient priority sorting
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_priority_status
            ON patients (status, priority, created_at)
        ''')

        conn.commit()
        print("[Queue DB] Database initialized successfully")


def calculate_priority(triage_level: str, confidence: int) -> int:
    """
    Calculate queue priority based on triage level and confidence.
    Lower number = higher priority.

    Priority ranges:
    - RED: 1-3 (highest)
    - YELLOW: 4-6 (medium)
    - GREEN: 7-9 (lowest)

    Within each level, higher confidence = higher priority.
    """
    base_priority = {
        'RED': 1,
        'YELLOW': 4,
        'GREEN': 7
    }.get(triage_level.upper(), 7)

    # Adjust within range based on confidence (higher confidence = lower priority number)
    confidence_adjustment = 2 - int(confidence / 50)  # 0-2 adjustment

    return max(1, min(9, base_priority + confidence_adjustment))


def add_patient(patient_data: Dict[str, Any]) -> str:
    """
    Add a new patient to the queue.

    Args:
        patient_data: Dictionary containing triage result and optional notes

    Returns:
        The generated patient ID
    """
    patient_id = str(uuid.uuid4())[:8].upper()  # Short readable ID
    now = datetime.utcnow().isoformat() + "Z"

    # Extract triage data - use 'or {}' to handle None values
    triage = patient_data.get('triage') or {}
    quality = patient_data.get('quality') or {}
    whisper = patient_data.get('whisper') or {}
    wer = patient_data.get('wer') or {}
    agreement = patient_data.get('agreement') or {}

    # Calculate priority
    triage_level = triage.get('level', 'GREEN')
    confidence = triage.get('confidence', 50)
    priority = calculate_priority(triage_level, confidence)

    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO patients (
                id, created_at, updated_at,
                triage_level, triage_score, triage_confidence, triage_message, triage_action,
                snr_db, speech_percentage, quality_is_reliable,
                whisper_transcription, whisper_confidence, whisper_avg_logprob,
                wer_score, wer_severity,
                agreement_percentage, agreement_consensus, agreement_verdict,
                flags_json, detailed_flags_json, features_json,
                status, priority, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            patient_id,
            now,
            now,
            triage_level,
            triage.get('score', 0),
            confidence,
            triage.get('message', ''),
            triage.get('action', ''),
            quality.get('snr_db'),
            quality.get('speech_percentage'),
            1 if quality.get('is_reliable') else 0,
            whisper.get('transcription'),
            whisper.get('confidence_score'),
            whisper.get('avg_logprob'),
            wer.get('wer'),
            wer.get('severity'),
            agreement.get('agreementPercentage'),
            agreement.get('consensusLevel'),
            agreement.get('overallVerdict'),
            json.dumps(triage.get('flags', [])),
            json.dumps(triage.get('detailedFlags', [])),
            json.dumps(patient_data.get('features', {})),
            'pending',
            priority,
            patient_data.get('notes', '')
        ))

        conn.commit()

    print(f"[Queue DB] Added patient {patient_id} with priority {priority}")
    return patient_id


def get_queue(status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Get all patients in the queue, sorted by priority.

    Args:
        status_filter: Optional filter by status ('pending', 'reviewing', 'completed', 'referred')

    Returns:
        List of patient dictionaries
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        if status_filter:
            cursor.execute('''
                SELECT * FROM patients
                WHERE status = ?
                ORDER BY priority ASC, created_at ASC
            ''', (status_filter,))
        else:
            cursor.execute('''
                SELECT * FROM patients
                ORDER BY
                    CASE status
                        WHEN 'pending' THEN 1
                        WHEN 'reviewing' THEN 2
                        WHEN 'referred' THEN 3
                        WHEN 'completed' THEN 4
                    END,
                    priority ASC,
                    created_at ASC
            ''')

        rows = cursor.fetchall()

        patients = []
        for row in rows:
            patient = dict(row)

            # Parse JSON fields
            patient['flags'] = json.loads(patient.get('flags_json') or '[]')
            patient['detailedFlags'] = json.loads(patient.get('detailed_flags_json') or '[]')
            patient['features'] = json.loads(patient.get('features_json') or '{}')

            # Clean up JSON fields from response
            del patient['flags_json']
            del patient['detailed_flags_json']
            del patient['features_json']

            # Convert boolean
            patient['quality_is_reliable'] = bool(patient.get('quality_is_reliable'))

            patients.append(patient)

        return patients


def get_patient(patient_id: str) -> Optional[Dict[str, Any]]:
    """Get a single patient by ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM patients WHERE id = ?', (patient_id,))
        row = cursor.fetchone()

        if not row:
            return None

        patient = dict(row)
        patient['flags'] = json.loads(patient.get('flags_json') or '[]')
        patient['detailedFlags'] = json.loads(patient.get('detailed_flags_json') or '[]')
        patient['features'] = json.loads(patient.get('features_json') or '{}')
        del patient['flags_json']
        del patient['detailed_flags_json']
        del patient['features_json']
        patient['quality_is_reliable'] = bool(patient.get('quality_is_reliable'))

        return patient


def update_status(
    patient_id: str,
    status: str,
    notes: Optional[str] = None,
    reviewed_by: Optional[str] = None,
    referred_to: Optional[str] = None
) -> bool:
    """
    Update a patient's status.

    Args:
        patient_id: The patient ID
        status: New status ('pending', 'reviewing', 'completed', 'referred')
        notes: Optional notes to add
        reviewed_by: Optional reviewer name
        referred_to: Optional referral destination

    Returns:
        True if update successful, False otherwise
    """
    valid_statuses = {'pending', 'reviewing', 'completed', 'referred'}
    if status not in valid_statuses:
        print(f"[Queue DB] Invalid status: {status}")
        return False

    now = datetime.utcnow().isoformat() + "Z"

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Build update query dynamically
        updates = ['status = ?', 'updated_at = ?']
        params = [status, now]

        if notes is not None:
            updates.append('notes = ?')
            params.append(notes)

        if reviewed_by is not None:
            updates.append('reviewed_by = ?')
            params.append(reviewed_by)

        if referred_to is not None:
            updates.append('referred_to = ?')
            params.append(referred_to)

        params.append(patient_id)

        cursor.execute(f'''
            UPDATE patients
            SET {', '.join(updates)}
            WHERE id = ?
        ''', params)

        conn.commit()

        if cursor.rowcount > 0:
            print(f"[Queue DB] Updated patient {patient_id} to status '{status}'")
            return True
        else:
            print(f"[Queue DB] Patient {patient_id} not found")
            return False


def delete_patient(patient_id: str) -> bool:
    """
    Delete a patient from the queue.

    Args:
        patient_id: The patient ID to delete

    Returns:
        True if deletion successful, False otherwise
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM patients WHERE id = ?', (patient_id,))
        conn.commit()

        if cursor.rowcount > 0:
            print(f"[Queue DB] Deleted patient {patient_id}")
            return True
        else:
            print(f"[Queue DB] Patient {patient_id} not found")
            return False


def get_queue_stats() -> Dict[str, Any]:
    """
    Get queue statistics.

    Returns:
        Dictionary with counts by level and status
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Count by triage level
        cursor.execute('''
            SELECT triage_level, COUNT(*) as count
            FROM patients
            WHERE status IN ('pending', 'reviewing')
            GROUP BY triage_level
        ''')
        level_counts = {row['triage_level']: row['count'] for row in cursor.fetchall()}

        # Count by status
        cursor.execute('''
            SELECT status, COUNT(*) as count
            FROM patients
            GROUP BY status
        ''')
        status_counts = {row['status']: row['count'] for row in cursor.fetchall()}

        # Total active (pending + reviewing)
        active_count = status_counts.get('pending', 0) + status_counts.get('reviewing', 0)

        return {
            'by_level': {
                'RED': level_counts.get('RED', 0),
                'YELLOW': level_counts.get('YELLOW', 0),
                'GREEN': level_counts.get('GREEN', 0)
            },
            'by_status': status_counts,
            'active_count': active_count,
            'total_count': sum(status_counts.values())
        }


def export_queue_csv() -> str:
    """
    Export queue data as CSV string.

    Returns:
        CSV formatted string
    """
    patients = get_queue()

    if not patients:
        return "No patients in queue"

    # CSV headers
    headers = [
        'ID', 'Created', 'Status', 'Priority',
        'Triage Level', 'Score', 'Confidence',
        'SNR (dB)', 'Speech %', 'Quality Reliable',
        'WER', 'WER Severity',
        'Agreement %', 'Consensus',
        'Notes'
    ]

    rows = [','.join(headers)]

    for p in patients:
        row = [
            p.get('id', ''),
            p.get('created_at', ''),
            p.get('status', ''),
            str(p.get('priority', '')),
            p.get('triage_level', ''),
            str(p.get('triage_score', '')),
            str(p.get('triage_confidence', '')),
            str(p.get('snr_db', '') or ''),
            str(p.get('speech_percentage', '') or ''),
            'Yes' if p.get('quality_is_reliable') else 'No',
            str(p.get('wer_score', '') or ''),
            p.get('wer_severity', '') or '',
            str(p.get('agreement_percentage', '') or ''),
            p.get('agreement_consensus', '') or '',
            f'"{p.get("notes", "")}"' if p.get('notes') else ''
        ]
        rows.append(','.join(row))

    return '\n'.join(rows)


# Initialize database when module is imported
init_db()
