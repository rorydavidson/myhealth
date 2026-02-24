import SwiftUI

/// Section header with category colour accent underline.
/// Used at the top of each dashboard section (Activity, Heart, Sleep, etc.).
struct SectionHeader: View {
    let title: String
    let category: MetricCategory

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: DesignTokens.Spacing.xs) {
                Image(systemName: category.primaryIcon)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(category.color)
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .textCase(.uppercase)
                    .tracking(0.5)
            }
            // Accent underline
            RoundedRectangle(cornerRadius: 1)
                .fill(category.color)
                .frame(height: 2)
                .frame(maxWidth: 32)
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(alignment: .leading, spacing: 16) {
        ForEach(MetricCategory.allCases, id: \.self) { category in
            SectionHeader(title: category.displayName, category: category)
        }
    }
    .padding()
}
