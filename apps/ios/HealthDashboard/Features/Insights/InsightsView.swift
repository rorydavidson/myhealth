import SwiftUI
import SwiftData

// MARK: - Main View

/// LLM-powered health insights chat.
///
/// Tier 1 (Standard): Only anonymised daily aggregates are sent to the LLM.
/// Tier 2 (Enhanced): Adds specific lab values / granular metrics with explicit per-query consent.
@MainActor
struct InsightsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \InsightMessage.createdAt, order: .forward)
    private var messages: [InsightMessage]

    @State private var inputText       = ""
    @State private var isStreaming     = false
    @State private var enhancedMode    = false
    @State private var showEnhancedWarning = false
    @State private var streamingContent = ""
    @State private var streamError: String?
    @State private var showDataSent    = false
    @State private var lastDataPreview: String?

    // Scroll proxy for auto-scroll
    @Namespace private var bottomID

    // Quick-ask chips
    private let chips: [String] = [
        String(localized: "insights.chip.heartTrend"),
        String(localized: "insights.chip.sleepQuality"),
        String(localized: "insights.chip.activitySummary"),
        String(localized: "insights.chip.weightProgress"),
    ]

    var body: some View {
        VStack(spacing: 0) {
            // Chat area
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        if messages.isEmpty && !isStreaming {
                            emptyState
                        } else {
                            ForEach(messages) { msg in
                                MessageBubble(message: msg)
                            }
                            if isStreaming {
                                StreamingBubble(content: streamingContent)
                            }
                            if let err = streamError {
                                ErrorBubble(message: err)
                            }
                            Color.clear
                                .frame(height: 1)
                                .id(bottomID)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
                .onChange(of: streamingContent) { _, _ in
                    withAnimation { proxy.scrollTo(bottomID, anchor: .bottom) }
                }
                .onChange(of: messages.count) { _, _ in
                    withAnimation { proxy.scrollTo(bottomID, anchor: .bottom) }
                }
            }

            Divider()

            // Quick-ask chips (only when no messages yet)
            if messages.isEmpty && !isStreaming {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(chips, id: \.self) { chip in
                            Button {
                                inputText = chip
                            } label: {
                                Text(chip)
                                    .font(.caption)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(DesignTokens.Colors.activity.opacity(0.12))
                                    .foregroundStyle(DesignTokens.Colors.activity)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                }
            }

            // Enhanced mode banner
            if enhancedMode {
                EnhancedModeBanner(onDisable: { enhancedMode = false })
            }

            // Data-sent preview bar
            if let preview = lastDataPreview, !isStreaming {
                DataSentBar(preview: preview, isExpanded: $showDataSent)
            }

            // Input row
            inputRow
        }
        .navigationTitle(String(localized: "tab.insights"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 12) {
                    // Enhanced mode toggle
                    Button {
                        if enhancedMode {
                            enhancedMode = false
                        } else {
                            showEnhancedWarning = true
                        }
                    } label: {
                        Image(systemName: enhancedMode ? "lock.open.fill" : "lock.fill")
                            .foregroundStyle(enhancedMode ? DesignTokens.Colors.warning : .secondary)
                    }
                    .accessibilityLabel(enhancedMode
                        ? String(localized: "insights.enhanced.disable")
                        : String(localized: "insights.enhanced.enable"))

                    // Clear history
                    if !messages.isEmpty {
                        Button(role: .destructive) {
                            clearHistory()
                        } label: {
                            Image(systemName: "trash")
                                .foregroundStyle(.secondary)
                        }
                        .accessibilityLabel(String(localized: "insights.clearHistory"))
                    }
                }
            }
        }
        .alert(String(localized: "insights.enhanced.title"), isPresented: $showEnhancedWarning) {
            Button(String(localized: "insights.enhanced.enable"), role: .destructive) {
                enhancedMode = true
            }
            Button(String(localized: "common.cancel"), role: .cancel) {}
        } message: {
            Text(String(localized: "insights.enhanced.warning"))
        }
        .safeAreaInset(edge: .bottom) {
            Color.clear.frame(height: 0)
        }
    }

    // MARK: - Sub-views

    private var emptyState: some View {
        VStack(spacing: 20) {
            Image(systemName: "sparkles")
                .font(.system(size: 52))
                .foregroundStyle(DesignTokens.Colors.activity)
                .padding(.top, 40)
            Text(String(localized: "insights.empty.title"))
                .font(.title3.weight(.semibold))
            Text(String(localized: "insights.empty.message"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Text(String(localized: "insights.disclaimer"))
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
    }

    private var inputRow: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField(String(localized: "insights.input.placeholder"), text: $inputText, axis: .vertical)
                .lineLimit(1...5)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 20))

            Button {
                Task { await sendMessage() }
            } label: {
                Image(systemName: isStreaming ? "stop.circle.fill" : "arrow.up.circle.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(
                        inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isStreaming
                        ? Color.secondary
                        : DesignTokens.Colors.activity
                    )
            }
            .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isStreaming)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(.systemBackground))
    }

    // MARK: - Actions

    private func sendMessage() async {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        inputText = ""
        streamError = nil
        streamingContent = ""
        showDataSent = false
        isStreaming = true

        // Persist user message
        let userMsg = InsightMessage(role: .user, content: text, enhancedMode: enhancedMode)
        modelContext.insert(userMsg)

        do {
            let options = LLMService.QueryOptions(
                userMessage: text,
                enhancedMode: enhancedMode,
                extraContext: ""
            )
            let container = modelContext.container
            let (prompt, stream) = try await LLMService.shared.query(options: options, container: container)
            lastDataPreview = prompt.dataSentPreview

            // Collect streamed chunks
            var fullResponse = ""
            for try await chunk in stream {
                fullResponse += chunk
                streamingContent = fullResponse
            }

            // Persist assistant message
            let assistantMsg = InsightMessage(
                role: .assistant,
                content: fullResponse,
                dataSentPreview: prompt.dataSentPreview,
                enhancedMode: enhancedMode
            )
            modelContext.insert(assistantMsg)

        } catch {
            streamError = error.localizedDescription
        }

        isStreaming = false
        streamingContent = ""

        // Enhanced mode resets after each query (per privacy spec)
        enhancedMode = false
    }

    private func clearHistory() {
        for msg in messages {
            modelContext.delete(msg)
        }
        lastDataPreview = nil
        streamError = nil
    }
}

// MARK: - Message Bubble

private struct MessageBubble: View {
    let message: InsightMessage

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if message.messageRole == .user { Spacer(minLength: 48) }

            if message.messageRole == .assistant {
                Image(systemName: "sparkles")
                    .font(.caption)
                    .foregroundStyle(DesignTokens.Colors.activity)
                    .frame(width: 24, height: 24)
                    .background(DesignTokens.Colors.activity.opacity(0.1))
                    .clipShape(Circle())
            }

            VStack(alignment: message.messageRole == .user ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(.body)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(message.messageRole == .user
                        ? DesignTokens.Colors.activity
                        : Color(.secondarySystemBackground))
                    .foregroundStyle(message.messageRole == .user ? .white : .primary)
                    .clipShape(RoundedRectangle(cornerRadius: 18))

                if message.messageRole == .assistant {
                    HStack(spacing: 4) {
                        Image(systemName: "info.circle")
                            .font(.caption2)
                        Text(String(localized: "insights.disclaimer.short"))
                            .font(.caption2)
                    }
                    .foregroundStyle(.tertiary)
                    .padding(.horizontal, 4)
                }

                if message.enhancedMode {
                    Text(String(localized: "insights.enhanced.label"))
                        .font(.caption2)
                        .foregroundStyle(DesignTokens.Colors.warning)
                        .padding(.horizontal, 4)
                }
            }

            if message.messageRole == .assistant { Spacer(minLength: 48) }
        }
    }
}

// MARK: - Streaming Bubble

private struct StreamingBubble: View {
    let content: String

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            Image(systemName: "sparkles")
                .font(.caption)
                .foregroundStyle(DesignTokens.Colors.activity)
                .frame(width: 24, height: 24)
                .background(DesignTokens.Colors.activity.opacity(0.1))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 4) {
                Group {
                    if content.isEmpty {
                        HStack(spacing: 4) {
                            ProgressView()
                                .progressViewStyle(.circular)
                                .scaleEffect(0.7)
                            Text(String(localized: "insights.thinking"))
                                .font(.body)
                                .foregroundStyle(.secondary)
                        }
                    } else {
                        Text(content)
                            .font(.body)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 18))
            }

            Spacer(minLength: 48)
        }
    }
}

// MARK: - Error Bubble

private struct ErrorBubble: View {
    let message: String

    var body: some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(DesignTokens.Colors.negative)
            Text(message)
                .font(.caption)
                .foregroundStyle(DesignTokens.Colors.negative)
            Spacer()
        }
        .padding(12)
        .background(DesignTokens.Colors.negative.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Enhanced Mode Banner

private struct EnhancedModeBanner: View {
    let onDisable: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(DesignTokens.Colors.warning)
            VStack(alignment: .leading, spacing: 1) {
                Text(String(localized: "insights.enhanced.activeTitle"))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(DesignTokens.Colors.warning)
                Text(String(localized: "insights.enhanced.activeSubtitle"))
                    .font(.caption2)
                    .foregroundStyle(DesignTokens.Colors.warning.opacity(0.8))
            }
            Spacer()
            Button(String(localized: "common.disable")) {
                onDisable()
            }
            .font(.caption.weight(.medium))
            .foregroundStyle(DesignTokens.Colors.warning)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(DesignTokens.Colors.warning.opacity(0.1))
    }
}

// MARK: - Data Sent Bar

private struct DataSentBar: View {
    let preview: String
    @Binding var isExpanded: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "eye.slash")
                        .font(.caption2)
                    Text(String(localized: "insights.dataSent.label"))
                        .font(.caption)
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption2)
                }
                .foregroundStyle(.secondary)
                .padding(.horizontal, 16)
                .padding(.vertical, 6)
            }
            .buttonStyle(.plain)

            if isExpanded {
                Text(preview)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .background(Color(.tertiarySystemBackground))
    }
}
