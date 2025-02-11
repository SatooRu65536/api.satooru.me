import dayjs from "dayjs";
import { ofetch } from "ofetch";
import { GitHubEvent, GitHubRepo } from "~~/types";

const IGNORE_EVENTS_TYPE = ["WatchEvent"];
const CACHE_KEY = "projects";

export default defineEventHandler(async () => {
  const storage = useStorage<GitHubRepo[]>("kv");

  const cachedProjects = await storage.getItem(CACHE_KEY);
  if (cachedProjects) return cachedProjects;

  const events = await ofetch<GitHubEvent[]>(
    "https://api.github.com/users/SatooRu65536/events",
    {
      headers: { "User-Agent": "SatooRu65536" },
      parseResponse: JSON.parse,
    },
  ).catch((e) => {
    console.error(e);
    return [];
  });

  const recentEventRepoUrls = events
    .filter(
      (event) =>
        !IGNORE_EVENTS_TYPE.includes(event.type) &&
        dayjs(event.created_at).isAfter(dayjs().subtract(2, "week")),
    )
    .map((event) => event.repo.url);

  const uniqueRepoUrls = Array.from(new Set(recentEventRepoUrls));

  const projectsWithNull: GitHubRepo[] = await Promise.all(
    uniqueRepoUrls.map((url) =>
      ofetch<GitHubRepo>(url, {
        headers: { "User-Agent": "SatooRu65536" },
        parseResponse: JSON.parse,
      })
        .then((repo) => {
          const tags = repo.topics.map((t) => t.toLowerCase());

          const { name } = repo;
          const summary = repo.description;
          const repository = repo.html_url;
          const site = repo.homepage;
          const updatedAt = repo.pushed_at;
          return {
            name,
            summary,
            tags,
            repository,
            site,
            updatedAt,
          };
        })
        .catch(() => undefined),
    ),
  );

  const projects = projectsWithNull.filter((p) => p !== undefined);
  await storage.setItem(CACHE_KEY, projects, {
    expirationTtl: 60 * 60, // 1 day
  });

  return projects;
});
