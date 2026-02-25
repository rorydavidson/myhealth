import Foundation
import SwiftData

// MARK: - IPS Service

/// Generates an IPS (International Patient Summary) FHIR R4 Bundle entirely on-device.
///
/// The bundle is built from SwiftData models already stored locally.
/// Nothing is sent to the server — this is a pure client-side export.
///
/// IPS specification: https://hl7.org/fhir/uv/ips/
actor IPSService {
    static let shared = IPSService()
    private init() {}

    // MARK: - Public API

    /// Build the complete FHIR R4 IPS Bundle from the current SwiftData store.
    ///
    /// - Parameters:
    ///   - patientName: Name entered by the user at export time (not stored on-device).
    ///   - container: The active SwiftData `ModelContainer`.
    /// - Returns: A fully formed `FHIRBundle` ready for JSON export or preview rendering.
    func buildBundle(patientName: String, container: ModelContainer) async -> FHIRBundle {
        let snapshot = await MainActor.run { fetchSnapshot(container: container) }
        return buildFHIRBundle(patientName: patientName, snapshot: snapshot)
    }

    /// Encode the bundle to pretty-printed JSON data.
    func jsonData(for bundle: FHIRBundle) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(bundle)
    }

    // MARK: - Data Snapshot (Sendable value types — no @Model objects cross actor boundaries)

    struct ConditionSnapshot: Sendable {
        var id: String; var snomedCode: String; var snomedDisplay: String
        var status: String; var onsetDate: String?; var notes: String?
    }
    struct MedicationSnapshot: Sendable {
        var id: String; var snomedCode: String; var snomedDisplay: String
        var dose: String?; var startDate: String?; var endDate: String?
        var status: String; var reason: String?; var notes: String?
    }
    struct AllergySnapshot: Sendable {
        var id: String; var snomedCode: String; var snomedDisplay: String
        var type: String; var category: String; var criticality: String
        var reaction: String?; var onsetDate: String?; var notes: String?
    }
    struct LabResultSnapshot: Sendable {
        var id: String; var date: String; var category: String
        var structuredValues: [String: LabValue]?
    }
    struct DailySummarySnapshot: Sendable {
        var metricType: String; var date: String; var avg: Double?; var sum: Double?; var min: Double?
    }

    private struct DataSnapshot: Sendable {
        var conditions: [ConditionSnapshot]
        var medications: [MedicationSnapshot]
        var allergies: [AllergySnapshot]
        var labResults: [LabResultSnapshot]
        var dailySummaries: [DailySummarySnapshot]
    }

    @MainActor
    private func fetchSnapshot(container: ModelContainer) -> DataSnapshot {
        let ctx = container.mainContext
        let conds   = (try? ctx.fetch(FetchDescriptor<ClinicalCondition>(sortBy: [SortDescriptor(\.createdAt, order: .reverse)]))) ?? []
        let meds    = (try? ctx.fetch(FetchDescriptor<Medication>(sortBy: [SortDescriptor(\.createdAt, order: .reverse)]))) ?? []
        let allrgs  = (try? ctx.fetch(FetchDescriptor<Allergy>(sortBy: [SortDescriptor(\.createdAt, order: .reverse)]))) ?? []
        let labs    = (try? ctx.fetch(FetchDescriptor<LabResult>(sortBy: [SortDescriptor(\.date, order: .reverse)]))) ?? []
        let summrys = (try? ctx.fetch(FetchDescriptor<DailySummary>(sortBy: [SortDescriptor(\.date, order: .reverse)]))) ?? []
        return DataSnapshot(
            conditions: conds.map { ConditionSnapshot(id: $0.id, snomedCode: $0.snomedCode, snomedDisplay: $0.snomedDisplay, status: $0.status, onsetDate: $0.onsetDate, notes: $0.notes) },
            medications: meds.map { MedicationSnapshot(id: $0.id, snomedCode: $0.snomedCode, snomedDisplay: $0.snomedDisplay, dose: $0.dose, startDate: $0.startDate, endDate: $0.endDate, status: $0.status, reason: $0.reason, notes: $0.notes) },
            allergies: allrgs.map { AllergySnapshot(id: $0.id, snomedCode: $0.snomedCode, snomedDisplay: $0.snomedDisplay, type: $0.type, category: $0.category, criticality: $0.criticality, reaction: $0.reaction, onsetDate: $0.onsetDate, notes: $0.notes) },
            labResults: labs.map { LabResultSnapshot(id: $0.id, date: $0.date, category: $0.category, structuredValues: $0.structuredValues) },
            dailySummaries: summrys.map { DailySummarySnapshot(metricType: $0.metricType, date: $0.date, avg: $0.avg, sum: $0.sum, min: $0.min) }
        )
    }

    // MARK: - Bundle Construction

    private func buildFHIRBundle(patientName: String, snapshot: DataSnapshot) -> FHIRBundle {
        let now = iso8601Now()
        let patientID = "patient-1"
        let patientRef = FHIRReference(reference: "Patient/\(patientID)", display: patientName.isEmpty ? nil : patientName)

        // Build resource entries
        var entries: [FHIRBundleEntry] = []

        // Patient
        let patient = makePatient(id: patientID, name: patientName)
        entries.append(FHIRBundleEntry(fullUrl: "urn:uuid:\(patientID)", resource: .patient(patient)))

        // Vital sign observations from daily summaries (most recent 30 days)
        let cal = Calendar(identifier: .gregorian)
        let cutoff = isoDate(cal.date(byAdding: .day, value: -30, to: .now)!)
        let recentSummaries = snapshot.dailySummaries.filter { $0.date >= cutoff }
        let vitalObservations = makeVitalObservations(from: recentSummaries, patientRef: patientRef)
        for obs in vitalObservations {
            entries.append(FHIRBundleEntry(fullUrl: "urn:uuid:\(obs.id)", resource: .observation(obs)))
        }

        // Lab result observations
        let labObservations = makeLabObservations(from: snapshot.labResults, patientRef: patientRef)
        for obs in labObservations {
            entries.append(FHIRBundleEntry(fullUrl: "urn:uuid:\(obs.id)", resource: .observation(obs)))
        }

        // Conditions (Problem List)
        let fhirConditions = snapshot.conditions.map { makeFHIRCondition(from: $0, patientRef: patientRef) }
        for cond in fhirConditions {
            entries.append(FHIRBundleEntry(fullUrl: "urn:uuid:\(cond.id)", resource: .condition(cond)))
        }

        // Medications
        let fhirMeds = snapshot.medications.map { makeMedicationStatement(from: $0, patientRef: patientRef) }
        for med in fhirMeds {
            entries.append(FHIRBundleEntry(fullUrl: "urn:uuid:\(med.id)", resource: .medicationStatement(med)))
        }

        // Allergies
        let fhirAllergies = snapshot.allergies.map { makeFHIRAllergy(from: $0, patientRef: patientRef) }
        for al in fhirAllergies {
            entries.append(FHIRBundleEntry(fullUrl: "urn:uuid:\(al.id)", resource: .allergyIntolerance(al)))
        }

        // Composition (must be first non-patient entry per IPS spec)
        let composition = makeComposition(
            patientRef: patientRef,
            vitalRefs: vitalObservations.map { FHIRReference(reference: "Observation/\($0.id)") },
            labRefs: labObservations.map { FHIRReference(reference: "Observation/\($0.id)") },
            conditionRefs: fhirConditions.map { FHIRReference(reference: "Condition/\($0.id)") },
            medicationRefs: fhirMeds.map { FHIRReference(reference: "MedicationStatement/\($0.id)") },
            allergyRefs: fhirAllergies.map { FHIRReference(reference: "AllergyIntolerance/\($0.id)") },
            date: now,
            patientName: patientName
        )
        // Insert composition as second entry (after patient)
        entries.insert(
            FHIRBundleEntry(fullUrl: "urn:uuid:\(composition.id)", resource: .composition(composition)),
            at: 1
        )

        return FHIRBundle(
            id: UUID().uuidString,
            meta: FHIRMeta(profile: ["http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips"]),
            identifier: FHIRIdentifier(system: "urn:ietf:rfc:4122", value: UUID().uuidString),
            timestamp: now,
            entry: entries
        )
    }

    // MARK: - Patient

    private func makePatient(id: String, name: String) -> FHIRPatient {
        var nameObj: FHIRHumanName? = nil
        if !name.isEmpty {
            nameObj = FHIRHumanName(use: "official", text: name)
        }
        return FHIRPatient(
            id: id,
            meta: FHIRMeta(profile: ["http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips"]),
            name: nameObj.map { [$0] }
        )
    }

    // MARK: - Vital Signs

    /// Maps daily summary aggregates to FHIR Observation resources for the vital signs section.
    /// Uses the most recent average value per metric type.
    private func makeVitalObservations(
        from summaries: [DailySummarySnapshot],
        patientRef: FHIRReference
    ) -> [FHIRObservation] {
        let vitalMetrics: [(metric: String, loincCode: FHIRCoding, unit: String, ucumCode: String, additive: Bool)] = [
            ("heart_rate",         LOINC.heartRate,        "bpm",          "/min",   false),
            ("resting_heart_rate", LOINC.restingHeartRate, "bpm",          "/min",   false),
            ("oxygen_saturation",  LOINC.oxygenSaturation, "%",            "%",      false),
            ("respiratory_rate",   LOINC.respiratoryRate,  "breaths/min",  "/min",   false),
            ("body_mass",          LOINC.bodyWeight,       "kg",           "kg",     false),
            ("hrv",                LOINC.hrv,              "ms",           "ms",     false),
        ]

        // Group by metric type, pick most recent non-nil value
        var byMetric: [String: [DailySummarySnapshot]] = [:]
        for s in summaries { byMetric[s.metricType, default: []].append(s) }

        var observations: [FHIRObservation] = []

        for config in vitalMetrics {
            guard let days = byMetric[config.metric], !days.isEmpty else { continue }
            let values = days.compactMap { config.additive ? $0.sum : $0.avg }
            guard !values.isEmpty else { continue }
            let avg = values.reduce(0, +) / Double(values.count)
            let mostRecent = days.first // already sorted reverse

            let obs = FHIRObservation(
                id: UUID().uuidString,
                meta: FHIRMeta(profile: ["http://hl7.org/fhir/uv/ips/StructureDefinition/Observation-vitalSigns-uv-ips"]),
                status: "final",
                category: [FHIRCodeableConcept(coding: [
                    FHIRCoding(system: "http://terminology.hl7.org/CodeSystem/observation-category",
                               code: "vital-signs", display: "Vital Signs")
                ])],
                code: FHIRCodeableConcept(coding: [config.loincCode], text: config.loincCode.display),
                subject: patientRef,
                effectiveDateTime: mostRecent?.date,
                valueQuantity: FHIRQuantity(
                    value: (avg * 10).rounded() / 10,
                    unit: config.unit,
                    system: "http://unitsofmeasure.org",
                    code: config.ucumCode
                )
            )
            observations.append(obs)
        }

        // Blood pressure — systolic + diastolic as component
        if let bpDays = byMetric["blood_pressure"], !bpDays.isEmpty {
            let systolicVals = bpDays.compactMap { $0.avg }
            let diastolicVals = bpDays.compactMap { $0.min }
            if !systolicVals.isEmpty {
                let systolicAvg = systolicVals.reduce(0, +) / Double(systolicVals.count)
                let diastolicAvg = diastolicVals.isEmpty ? 0.0 : diastolicVals.reduce(0, +) / Double(diastolicVals.count)
                let bpObs = FHIRObservation(
                    id: UUID().uuidString,
                    meta: FHIRMeta(profile: ["http://hl7.org/fhir/uv/ips/StructureDefinition/Observation-vitalSigns-uv-ips"]),
                    status: "final",
                    category: [FHIRCodeableConcept(coding: [
                        FHIRCoding(system: "http://terminology.hl7.org/CodeSystem/observation-category",
                                   code: "vital-signs", display: "Vital Signs")
                    ])],
                    code: FHIRCodeableConcept(coding: [LOINC.bloodPressure], text: "Blood pressure panel"),
                    subject: patientRef,
                    effectiveDateTime: bpDays.first?.date,
                    component: [
                        FHIRObservationComponent(
                            code: FHIRCodeableConcept(coding: [LOINC.systolicBP]),
                            valueQuantity: FHIRQuantity(value: systolicAvg.rounded(), unit: "mmHg",
                                                        system: "http://unitsofmeasure.org", code: "mm[Hg]")
                        ),
                        FHIRObservationComponent(
                            code: FHIRCodeableConcept(coding: [LOINC.diastolicBP]),
                            valueQuantity: FHIRQuantity(value: diastolicAvg.rounded(), unit: "mmHg",
                                                        system: "http://unitsofmeasure.org", code: "mm[Hg]")
                        )
                    ]
                )
                observations.append(bpObs)
            }
        }

        return observations
    }

    // MARK: - Lab Results

    private func makeLabObservations(
        from labResults: [LabResultSnapshot],
        patientRef: FHIRReference
    ) -> [FHIRObservation] {
        var observations: [FHIRObservation] = []

        for lab in labResults {
            guard let structured = lab.structuredValues else { continue }
            for (testName, labValue) in structured {
                var code = FHIRCodeableConcept(
                    coding: [],
                    text: testName
                )
                if let loincCode = labValue.loincCode {
                    code.coding = [FHIRCoding(system: "http://loinc.org", code: loincCode, display: testName)]
                }

                let obs = FHIRObservation(
                    id: UUID().uuidString,
                    status: "final",
                    category: [FHIRCodeableConcept(coding: [
                        FHIRCoding(system: "http://terminology.hl7.org/CodeSystem/observation-category",
                                   code: "laboratory", display: "Laboratory")
                    ])],
                    code: code,
                    subject: patientRef,
                    effectiveDateTime: lab.date,
                    valueQuantity: FHIRQuantity(value: labValue.value, unit: labValue.unit)
                )
                observations.append(obs)
            }
        }

        return observations
    }

    // MARK: - Conditions

    private func makeFHIRCondition(from condition: ConditionSnapshot, patientRef: FHIRReference) -> FHIRCondition {
        let status = ConditionStatus(rawValue: condition.status) ?? .active
        let clinicalStatusCode: FHIRCoding
        switch status {
        case .active:   clinicalStatusCode = FHIRCoding(system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active", display: "Active")
        case .resolved: clinicalStatusCode = FHIRCoding(system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "resolved", display: "Resolved")
        case .inactive: clinicalStatusCode = FHIRCoding(system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "inactive", display: "Inactive")
        }

        return FHIRCondition(
            id: condition.id,
            meta: FHIRMeta(profile: ["http://hl7.org/fhir/uv/ips/StructureDefinition/Condition-uv-ips"]),
            clinicalStatus: FHIRCodeableConcept(coding: [clinicalStatusCode]),
            code: FHIRCodeableConcept(
                coding: [FHIRCoding(system: "http://snomed.info/sct", code: condition.snomedCode, display: condition.snomedDisplay)],
                text: condition.snomedDisplay
            ),
            subject: patientRef,
            onsetDateTime: condition.onsetDate,
            note: condition.notes.map { [FHIRAnnotation(text: $0)] },
            category: [FHIRCodeableConcept(coding: [
                FHIRCoding(system: "http://terminology.hl7.org/CodeSystem/condition-category",
                           code: "problem-list-item", display: "Problem List Item")
            ])]
        )
    }

    // MARK: - Medications

    private func makeMedicationStatement(from med: MedicationSnapshot, patientRef: FHIRReference) -> FHIRMedicationStatement {
        let status = MedicationStatus(rawValue: med.status) ?? .active
        let fhirStatus: String
        switch status {
        case .active:  fhirStatus = "active"
        case .stopped: fhirStatus = "stopped"
        case .onHold:  fhirStatus = "on-hold"
        }

        var notes: [FHIRAnnotation] = []
        if let n = med.notes, !n.isEmpty { notes.append(FHIRAnnotation(text: n)) }

        return FHIRMedicationStatement(
            id: med.id,
            meta: FHIRMeta(profile: ["http://hl7.org/fhir/uv/ips/StructureDefinition/MedicationStatement-uv-ips"]),
            status: fhirStatus,
            medicationCodeableConcept: FHIRCodeableConcept(
                coding: [FHIRCoding(system: "http://snomed.info/sct", code: med.snomedCode, display: med.snomedDisplay)],
                text: med.snomedDisplay
            ),
            subject: patientRef,
            effectivePeriod: FHIRPeriod(start: med.startDate, end: med.endDate),
            dosage: med.dose.map { [FHIRDosage(text: $0)] },
            note: notes.isEmpty ? nil : notes,
            reasonCode: med.reason.map { [FHIRCodeableConcept(coding: [], text: $0)] }
        )
    }

    // MARK: - Allergies

    private func makeFHIRAllergy(from allergy: AllergySnapshot, patientRef: FHIRReference) -> FHIRAllergyIntolerance {
        let criticality = AllergyCriticality(rawValue: allergy.criticality) ?? .low
        let fhirCriticality: String
        switch criticality {
        case .high:           fhirCriticality = "high"
        case .low:            fhirCriticality = "low"
        case .unableToAssess: fhirCriticality = "unable-to-assess"
        }

        var reactions: [FHIRAllergyReaction]? = nil
        if let reaction = allergy.reaction, !reaction.isEmpty {
            reactions = [FHIRAllergyReaction(
                manifestation: [FHIRCodeableConcept(coding: [], text: reaction)],
                description: reaction
            )]
        }

        var notes: [FHIRAnnotation] = []
        if let n = allergy.notes, !n.isEmpty { notes.append(FHIRAnnotation(text: n)) }

        return FHIRAllergyIntolerance(
            id: allergy.id,
            meta: FHIRMeta(profile: ["http://hl7.org/fhir/uv/ips/StructureDefinition/AllergyIntolerance-uv-ips"]),
            clinicalStatus: FHIRCodeableConcept(coding: [SNOMED.allergyActive]),
            type: allergy.type,
            category: [allergy.category],
            criticality: fhirCriticality,
            code: FHIRCodeableConcept(
                coding: [FHIRCoding(system: "http://snomed.info/sct", code: allergy.snomedCode, display: allergy.snomedDisplay)],
                text: allergy.snomedDisplay
            ),
            patient: patientRef,
            onsetDateTime: allergy.onsetDate,
            reaction: reactions,
            note: notes.isEmpty ? nil : notes
        )
    }

    // MARK: - Composition

    private func makeComposition(
        patientRef: FHIRReference,
        vitalRefs: [FHIRReference],
        labRefs: [FHIRReference],
        conditionRefs: [FHIRReference],
        medicationRefs: [FHIRReference],
        allergyRefs: [FHIRReference],
        date: String,
        patientName: String
    ) -> FHIRComposition {
        let title = patientName.isEmpty
            ? String(localized: "ips.document.title")
            : String(localized: "ips.document.titleNamed \(patientName)")

        // Vital Signs section
        let vitalSection = FHIRCompositionSection(
            title: String(localized: "ips.section.vitalSigns"),
            code: FHIRCodeableConcept(coding: [LOINC.vitalSigns]),
            text: FHIRNarrative(status: "generated", div: "<div xmlns=\"http://www.w3.org/1999/xhtml\">Vital signs from recent health data</div>"),
            emptyReason: vitalRefs.isEmpty ? FHIRCodeableConcept(coding: [DataAbsentReason.noInformation]) : nil,
            entry: vitalRefs.isEmpty ? nil : vitalRefs
        )

        // Lab Results section
        let labSection = FHIRCompositionSection(
            title: String(localized: "ips.section.labResults"),
            code: FHIRCodeableConcept(coding: [LOINC.labResults]),
            text: FHIRNarrative(status: "generated", div: "<div xmlns=\"http://www.w3.org/1999/xhtml\">Laboratory results</div>"),
            emptyReason: labRefs.isEmpty ? FHIRCodeableConcept(coding: [DataAbsentReason.noInformation]) : nil,
            entry: labRefs.isEmpty ? nil : labRefs
        )

        // Medications section (required by IPS spec)
        let medSection = FHIRCompositionSection(
            title: String(localized: "ips.section.medications"),
            code: FHIRCodeableConcept(coding: [LOINC.medications]),
            text: FHIRNarrative(status: "generated", div: "<div xmlns=\"http://www.w3.org/1999/xhtml\">Medication summary</div>"),
            emptyReason: medicationRefs.isEmpty
                ? FHIRCodeableConcept(coding: [DataAbsentReason.noKnownMedications])
                : nil,
            entry: medicationRefs.isEmpty ? nil : medicationRefs
        )

        // Allergies section (required by IPS spec)
        let allergySection = FHIRCompositionSection(
            title: String(localized: "ips.section.allergies"),
            code: FHIRCodeableConcept(coding: [LOINC.allergies]),
            text: FHIRNarrative(status: "generated", div: "<div xmlns=\"http://www.w3.org/1999/xhtml\">Allergies and intolerances</div>"),
            emptyReason: allergyRefs.isEmpty
                ? FHIRCodeableConcept(coding: [DataAbsentReason.noKnownAllergies])
                : nil,
            entry: allergyRefs.isEmpty ? nil : allergyRefs
        )

        // Problem list (required by IPS spec)
        let problemSection = FHIRCompositionSection(
            title: String(localized: "ips.section.problems"),
            code: FHIRCodeableConcept(coding: [LOINC.problemList]),
            text: FHIRNarrative(status: "generated", div: "<div xmlns=\"http://www.w3.org/1999/xhtml\">Problem list</div>"),
            emptyReason: conditionRefs.isEmpty
                ? FHIRCodeableConcept(coding: [DataAbsentReason.noKnownProblems])
                : nil,
            entry: conditionRefs.isEmpty ? nil : conditionRefs
        )

        return FHIRComposition(
            id: UUID().uuidString,
            meta: FHIRMeta(profile: ["http://hl7.org/fhir/uv/ips/StructureDefinition/Composition-uv-ips"]),
            type: FHIRCodeableConcept(coding: [LOINC.patientSummary], text: "Patient Summary"),
            subject: patientRef,
            date: date,
            author: [FHIRReference(reference: "Patient/patient-1", display: patientName.isEmpty ? nil : patientName)],
            title: title,
            section: [vitalSection, labSection, medSection, allergySection, problemSection]
        )
    }

    // MARK: - Helpers

    private func iso8601Now() -> String {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime]
        return fmt.string(from: .now)
    }

    private func isoDate(_ date: Date) -> String {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withFullDate, .withDashSeparatorInDate]
        return fmt.string(from: date)
    }
}

// MARK: - IPS Preview Model

/// Flat, UI-friendly representation of the IPS data for the preview screen.
/// Built from a `FHIRBundle` — no FHIR knowledge needed in the view layer.
struct IPSPreviewData: Sendable {
    var patientName: String
    var generatedAt: Date
    var vitalSigns: [IPSObservationRow]
    var labResults: [IPSObservationRow]
    var conditions: [IPSClinicalRow]
    var medications: [IPSClinicalRow]
    var allergies: [IPSClinicalRow]

    struct IPSObservationRow: Identifiable, Sendable {
        var id: String
        var name: String
        var value: String
        var date: String?
    }

    struct IPSClinicalRow: Identifiable, Sendable {
        var id: String
        var display: String
        var detail: String?
        var status: String?
    }
}

extension IPSService {
    /// Build a flat `IPSPreviewData` from a FHIR Bundle for display in `IPSPreviewView`.
    func previewData(from bundle: FHIRBundle, patientName: String) -> IPSPreviewData {
        var vitals: [IPSPreviewData.IPSObservationRow] = []
        var labs: [IPSPreviewData.IPSObservationRow] = []
        var conditions: [IPSPreviewData.IPSClinicalRow] = []
        var medications: [IPSPreviewData.IPSClinicalRow] = []
        var allergies: [IPSPreviewData.IPSClinicalRow] = []

        for entry in bundle.entry {
            switch entry.resource {
            case .observation(let obs):
                let name = obs.code.text ?? obs.code.coding.first?.display ?? "—"
                let value: String
                if let vq = obs.valueQuantity {
                    let formatted = formatDouble(vq.value)
                    value = "\(formatted) \(vq.unit)"
                } else if let vs = obs.valueString {
                    value = vs
                } else if let components = obs.component, !components.isEmpty {
                    // Blood pressure
                    let parts = components.compactMap { comp -> String? in
                        guard let vq = comp.valueQuantity else { return nil }
                        return "\(formatDouble(vq.value))"
                    }
                    value = parts.joined(separator: "/") + " mmHg"
                } else {
                    value = "—"
                }
                let row = IPSPreviewData.IPSObservationRow(
                    id: obs.id,
                    name: name,
                    value: value,
                    date: obs.effectiveDateTime
                )
                let categories = obs.category?.flatMap { $0.coding.map(\.code) } ?? []
                if categories.contains("laboratory") {
                    labs.append(row)
                } else {
                    vitals.append(row)
                }

            case .condition(let cond):
                let status = cond.clinicalStatus.coding.first?.display
                conditions.append(IPSPreviewData.IPSClinicalRow(
                    id: cond.id,
                    display: cond.code.text ?? cond.code.coding.first?.display ?? "—",
                    detail: cond.onsetDateTime.map { "Onset: \($0)" },
                    status: status
                ))

            case .medicationStatement(let med):
                let detail = med.dosage?.first?.text
                medications.append(IPSPreviewData.IPSClinicalRow(
                    id: med.id,
                    display: med.medicationCodeableConcept.text ?? "—",
                    detail: detail,
                    status: med.status
                ))

            case .allergyIntolerance(let al):
                let criticality = al.criticality
                allergies.append(IPSPreviewData.IPSClinicalRow(
                    id: al.id,
                    display: al.code.text ?? al.code.coding.first?.display ?? "—",
                    detail: al.reaction?.first?.description,
                    status: criticality
                ))

            default:
                break
            }
        }

        return IPSPreviewData(
            patientName: patientName,
            generatedAt: .now,
            vitalSigns: vitals,
            labResults: labs,
            conditions: conditions,
            medications: medications,
            allergies: allergies
        )
    }

    private func formatDouble(_ v: Double) -> String {
        if v == v.rounded() && abs(v) < 1_000_000 {
            return String(Int(v))
        }
        return String(format: "%.1f", v)
    }
}
