import Foundation
import SwiftData

/// A single message in the LLM insights conversation history.
/// Stored locally in SwiftData — never sent to the server.
@Model
final class InsightMessage {
    @Attribute(.unique) var id: String

    /// `user` or `assistant`
    var role: String

    /// Message text content (assistant messages may be markdown)
    var content: String

    /// Anonymised health context that was sent with this message (Standard mode preview text)
    var dataSentPreview: String?

    /// Whether Enhanced mode was active when this message was sent
    var enhancedMode: Bool

    var createdAt: Date

    init(
        id: String = UUID().uuidString,
        role: MessageRole,
        content: String,
        dataSentPreview: String? = nil,
        enhancedMode: Bool = false,
        createdAt: Date = .now
    ) {
        self.id = id
        self.role = role.rawValue
        self.content = content
        self.dataSentPreview = dataSentPreview
        self.enhancedMode = enhancedMode
        self.createdAt = createdAt
    }

    var messageRole: MessageRole {
        MessageRole(rawValue: role) ?? .user
    }
}

enum MessageRole: String, Codable {
    case user
    case assistant
}
