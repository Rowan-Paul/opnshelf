# ADR 0050: Remove one-time Trakt Import

Status: Accepted. Supersedes ADR 0020 and the one-time Import, retention and handoff provisions of ADR 0049.

The operator requested complete removal of one-time Trakt Import, with no retained results or reconciliation workflow. Trakt Sync is the sole Trakt connection on Web and Mobile, including Onboarding.

Remove Import screens, prompts, polling, endpoints, workers, job data, item outcomes and confirmed Import mappings. A forward database migration drops the Import tables and deletes both active and archived Import jobs. Previously created Watches remain ordinary Shelf records; removing the importer does not delete users' Watch history or public PDS records. Trakt Sync keeps its independent links, title matching, consent and reconciliation.

Historical migrations remain so existing databases can upgrade. No production or Staging migration is run as part of this code change. The cleanup migration must accompany deployment of the backend and both clients without the retired Import flow.
