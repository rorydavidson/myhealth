import SwiftData

/// Configures and vends the shared `ModelContainer`.
/// Use `PersistenceController.shared` in production,
/// `PersistenceController.preview` in Xcode Previews and unit tests.
@MainActor
final class PersistenceController {
    static let shared = PersistenceController()

    /// In-memory container for Xcode Previews and unit tests.
    static let preview = PersistenceController(inMemory: true)

    let container: ModelContainer

    private init(inMemory: Bool = false) {
        let schema = Schema(SchemaV1.models)

        let configuration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: inMemory,
            allowsSave: true,
            // Health data excluded from iCloud backup by design (see PLAN-phase2-ios.md §21.3)
            cloudKitDatabase: .none
        )

        do {
            container = try ModelContainer(
                for: schema,
                migrationPlan: HealthDashboardMigrationPlan.self,
                configurations: [configuration]
            )
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }
    }
}
