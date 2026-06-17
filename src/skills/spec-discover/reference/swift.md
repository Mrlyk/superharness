# Swift (iOS / macOS) Detection Reference

Load this reference when the project has `Package.swift`, a `*.xcodeproj/` directory bundle, or a `*.xcworkspace/` directory bundle.

Scope: Apple platform apps (iOS, macOS). Server-side Swift and SPM-only libraries are out of scope for this reference -- fall back to general knowledge.

## Manifest Files

Note: `.xcodeproj` and `.xcworkspace` are **directory bundles**, not single files. Detect them by directory existence and extension, not by reading them as files directly.

| File / Bundle | What to extract |
|---------------|-----------------|
| `Package.swift` | `platforms` (iOS/macOS minimum version), `dependencies` (SPM packages), `targets`, `products` |
| `*.xcodeproj/project.pbxproj` | Deployment targets (`IPHONEOS_DEPLOYMENT_TARGET`, `MACOSX_DEPLOYMENT_TARGET`), Swift version (`SWIFT_VERSION`), Bundle ID (`PRODUCT_BUNDLE_IDENTIFIER`), build configurations |
| `*.xcworkspace/contents.xcworkspacedata` | Signal for multi-project workspace; lists included `.xcodeproj` bundles |
| `Info.plist` | `CFBundleIdentifier`, `CFBundleShortVersionString`, supported orientations, permissions |
| `*.xcdatamodeld/` | Core Data model presence |
| `.swiftlint.yml` / `.swiftformat` | Code style tool configs |
| `Tests/` / `*Tests/` / `*UITests/` | Test target directories |

## Dependency Manager Detection

| Indicator | Manager |
|-----------|---------|
| `Package.swift` with `dependencies:` | Swift Package Manager (SPM) |
| `Package.resolved` | SPM lock file (SPM in use) |
| `*.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` | SPM integrated inside an Xcode project |
| `Podfile` + `Podfile.lock` + `Pods/` | CocoaPods (legacy; note but do not deep-dive) |
| `Cartfile` + `Carthage/` | Carthage (legacy; note only) |

## Framework Detection Signatures

| Signal | Framework / Library |
|--------|---------------------|
| `import SwiftUI` in sources | SwiftUI |
| `import UIKit` | UIKit (iOS) |
| `import AppKit` | AppKit (macOS) |
| `@main` + `App` protocol conformance | SwiftUI app lifecycle |
| `UIApplicationDelegate` / `NSApplicationDelegate` | Classic app lifecycle |
| `import Combine` | Combine (reactive) |
| `async` / `await` / `actor` keywords | Swift Concurrency |
| `import RxSwift` | RxSwift |
| `import Alamofire` (or in `Package.swift`) | Alamofire (networking) |
| `*.xcdatamodeld/` present | Core Data |
| `import SwiftData` | SwiftData (iOS 17+ / macOS 14+) |
| `import RealmSwift` | Realm |
| `import XCTest` | XCTest |
| `import Testing` (Swift 5.9+) | swift-testing |
| `ComposableArchitecture` dependency | TCA (The Composable Architecture) |

## Detection Dimensions

Identify these aspects of the project (minimum useful set):

- **Platform & deployment target**: iOS / macOS / both, minimum OS version from `Package.swift` `platforms` or pbxproj `*_DEPLOYMENT_TARGET`
- **UI framework**: SwiftUI / UIKit / AppKit / mixed (SwiftUI embedded in UIKit via `UIHostingController` etc.)
- **Dependency manager**: SPM / CocoaPods / Carthage / mixed (record what is actually in use, not what is available)
- **Architecture pattern**: MVC / MVVM / TCA / Coordinator / VIPER -- infer from directory structure and naming; if no consistent pattern is observed, record "未观察到一致的架构模式"
- **Testing**: XCTest / swift-testing, test target directories, UI tests presence
- **Code style tools**: SwiftLint (via `.swiftlint.yml`) / SwiftFormat (via `.swiftformat`) / none

## Example Output

> - 平台/最低版本: iOS 16.0
> - UI 框架: SwiftUI (App 生命周期, 少量 UIKit 通过 UIViewRepresentable 桥接)
> - 并发模型: Swift Concurrency (async/await)
> - 依赖管理: SPM, 已集成 Alamofire / Kingfisher
> - 架构: MVVM (Views/ + ViewModels/ 目录分层)
> - 测试: XCTest, 测试目录 AppTests/, 无 UITests
> - 代码风格: SwiftLint (配置在 .swiftlint.yml)
> - 持久化: SwiftData (import SwiftData, @Model 标注的实体在 Models/)
