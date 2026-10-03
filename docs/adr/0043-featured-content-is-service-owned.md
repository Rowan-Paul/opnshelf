# ADR 0043: Featured Content is owned by the service

Status: Accepted and implemented.

For [Featured Content (#255)](https://github.com/Rowan-Paul/opnshelf/issues/255),
store the editorial selection in Opnshelf's service persistence rather than
the admin's personal AT Protocol records. These picks speak for Opnshelf;
the admin's account authorizes editing but does not own the published content.

Personal PDS records would make editorial content portable and federated,
but would couple the service's selection and its removal to an individual's
public identity. Service ownership keeps publication, corrections, and expiry
under Opnshelf's control. Publishing creates no Review, Activity, or Bluesky
Cross-post; it does not require a new public lexicon.
