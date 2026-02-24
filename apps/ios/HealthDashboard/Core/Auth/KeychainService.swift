import Foundation
import Security

/// Thread-safe, synchronous wrapper around the iOS Keychain.
///
/// Used exclusively for the session token — never in UserDefaults.
/// Items are stored with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`:
/// - Accessible after first unlock (background tasks can read)
/// - Never synced to iCloud Keychain (data stays on-device)
final class KeychainService: Sendable {
    static let shared = KeychainService()

    private let service = "com.healthdashboard.app"

    private init() {}

    // MARK: - Write

    func set(_ value: String, forKey key: String) throws {
        let data = Data(value.utf8)

        // Overwrite any existing value
        let updateQuery: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key,
        ]
        let updateAttributes: [CFString: Any] = [kSecValueData: data]
        let updateStatus = SecItemUpdate(updateQuery as CFDictionary, updateAttributes as CFDictionary)

        if updateStatus == errSecItemNotFound {
            // Item doesn't exist yet — add it
            let addQuery: [CFString: Any] = [
                kSecClass: kSecClassGenericPassword,
                kSecAttrService: service,
                kSecAttrAccount: key,
                kSecValueData: data,
                kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            ]
            let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
            guard addStatus == errSecSuccess else {
                throw KeychainError.writeFailed(addStatus)
            }
        } else if updateStatus != errSecSuccess {
            throw KeychainError.writeFailed(updateStatus)
        }
    }

    // MARK: - Read

    func get(forKey key: String) -> String? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard
            status == errSecSuccess,
            let data = result as? Data,
            let string = String(data: data, encoding: .utf8)
        else { return nil }

        return string
    }

    // MARK: - Delete

    @discardableResult
    func delete(forKey key: String) throws -> Bool {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.deleteFailed(status)
        }
        return status == errSecSuccess
    }
}

// MARK: - Errors

enum KeychainError: Error, LocalizedError {
    case writeFailed(OSStatus)
    case deleteFailed(OSStatus)

    var errorDescription: String? {
        switch self {
        case .writeFailed(let status):
            "Keychain write failed: \(status)"
        case .deleteFailed(let status):
            "Keychain delete failed: \(status)"
        }
    }
}
