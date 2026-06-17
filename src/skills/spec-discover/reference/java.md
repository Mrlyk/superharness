# Java / Kotlin Detection Reference

Load this reference when the project has `pom.xml`, `build.gradle`, or `build.gradle.kts`.

## Manifest Files

| File | What to extract |
|------|----------------|
| `pom.xml` | Dependencies, plugins, parent POM (Spring Boot starter version), Java version (`maven.compiler.source`) |
| `build.gradle` / `build.gradle.kts` | Dependencies, plugins, Java/Kotlin version, source compatibility |
| `settings.gradle` / `settings.gradle.kts` | Multi-module project structure, included modules |
| `application.yml` / `application.properties` | Spring Boot configuration, profiles, datasource config |
| `src/main/resources/` | Config files, templates (Thymeleaf/Freemarker), static resources, SQL migrations |
| `src/test/` | Test structure (mirrors main), test resources |
| `.mvn/` / `gradle/` / `gradlew` | Build wrapper config, Gradle version |
| `checkstyle.xml` / `spotbugs-exclude.xml` / `pmd-ruleset.xml` | Code quality tool configs |
| `Dockerfile` / `docker-compose.yml` | Deployment patterns, base image (JDK version) |
| `lombok.config` | Lombok usage indicator |

## Build Tool Detection

| Indicator | Build tool |
|-----------|-----------|
| `pom.xml` | Maven |
| `build.gradle` | Gradle (Groovy DSL) |
| `build.gradle.kts` | Gradle (Kotlin DSL) |
| Both `pom.xml` and `build.gradle` | Check which one is active (usually Gradle takes precedence) |

## Framework Detection Signatures

| Dependency / Plugin | Framework |
|--------------------|-----------|
| `spring-boot-starter-web` | Spring Boot (Spring MVC) |
| `spring-boot-starter-webflux` | Spring Boot (WebFlux, reactive) |
| `spring-boot-starter-data-jpa` | Spring Data JPA |
| `spring-boot-starter-security` | Spring Security |
| `spring-cloud-*` | Spring Cloud (microservices) |
| `io.quarkus` dependencies | Quarkus |
| `io.micronaut` dependencies | Micronaut |
| `org.jetbrains.kotlin` plugin | Kotlin project (check for `kotlin-spring` plugin) |
| `org.projectlombok` | Lombok (annotation-based boilerplate reduction) |
| `org.mapstruct` | MapStruct (object mapping) |

## Detection Dimensions

Identify these aspects of the project:

- **Build tool**: Maven / Gradle (Groovy or Kotlin DSL), wrapper version
- **Framework**: Spring Boot / Quarkus / Micronaut / Jakarta EE / Vert.x
- **Language**: Java (version from compiler settings) / Kotlin, source compatibility level
- **Testing**: JUnit 5 / JUnit 4 / TestNG, Mockito / MockK (Kotlin), Spring Boot Test, WireMock, Testcontainers
- **Code quality**: Checkstyle / SpotBugs / PMD / Spotless / SonarQube / ArchUnit
- **API style**: REST (Spring MVC / WebFlux) / gRPC / GraphQL (Spring GraphQL / Netflix DGS)
- **Data layer**: JPA/Hibernate / MyBatis / JOOQ / Spring Data, migration tool (Flyway / Liquibase)
- **Project structure**: Maven standard (`src/main/java/`) / multi-module / DDD layering (domain/application/infrastructure)
- **Dependency injection**: Spring IoC (constructor injection preferred) / CDI (Quarkus/Micronaut)
- **Reactive**: WebFlux + Project Reactor / blocking MVC / Kotlin coroutines

## Example Output

> - 语言/框架: Java 21 + Spring Boot 3.2
> - 构建工具: Gradle (Kotlin DSL)
> - 测试: JUnit 5 + Mockito + Spring Boot Test + Testcontainers
> - 代码质量: Checkstyle + SpotBugs, Lombok 生成样板代码
> - API: RESTful (Spring MVC), Controller 在 com.example.api/ 包下
> - 数据层: Spring Data JPA + Flyway 迁移
> - 项目结构: 多模块 (core / api / service)
> - DI: Spring 构造器注入
