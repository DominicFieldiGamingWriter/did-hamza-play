export async function getTeamFixtures(
  teamId: number
) {
  const [
    finishedData,
    liveData,
    upcomingData
  ] = await Promise.all([
    bsdGet<any>(
      "/events/",
      {
        team_id:
          teamId,
        status:
          "finished",
        limit:
          100
      }
    ),

    bsdGet<any>(
      "/events/",
      {
        team_id:
          teamId,
        status:
          "live",
        limit:
          100
      }
    ),

    bsdGet<any>(
      "/events/",
      {
        team_id:
          teamId,
        status:
          "notstarted",
        limit:
          100
      }
    )
  ]);

  let finished =
    responseArray(
      finishedData
    );

  let live =
    responseArray(
      liveData
    );

  let upcoming =
    responseArray(
      upcomingData
    );

  /*
   * BSD's actual event feed can return live
   * matches with a specific live status such
   * as "1st_half" rather than the generic
   * "live" value used by the filter.
   *
   * Therefore, also inspect the full event
   * list and identify events whose status
   * represents an active match.
   */
  if (live.length === 0) {
    const allEventsData =
      await bsdGet<any>(
        "/events/",
        {
          team_id:
            teamId,
          limit:
            100
        }
      );

    const allEvents =
      responseArray(
        allEventsData
      );

    const nonFinishedEvents =
      allEvents.filter(
        (fixture: any) => {
          const status =
            String(
              fixture?.status ??
              ""
            )
              .trim()
              .toLowerCase();

          return (
            status !==
              "finished" &&
            status !==
              "cancelled" &&
            status !==
              "postponed" &&
            status !==
              "unresolved"
          );
        }
      );

    const now =
      Date.now();

    live =
      nonFinishedEvents.filter(
        (fixture: any) => {
          const timestamp =
            fixtureTimestamp(
              fixture
            );

          return (
            timestamp > 0 &&
            timestamp <= now
          );
        }
      );
  }

  if (
    upcoming.length === 0
  ) {
    const fallback =
      await bsdGet<any>(
        "/events/",
        {
          team_id:
            teamId,
          status:
            "upcoming",
          limit:
            100
        }
      );

    upcoming =
      responseArray(
        fallback
      );
  }

  const now =
    Date.now();

  finished =
    finished
      .filter(
        (fixture) =>
          fixtureTimestamp(
            fixture
          ) > 0 &&
          fixtureTimestamp(
            fixture
          ) <= now
      )
      .sort(
        (a, b) =>
          fixtureTimestamp(b) -
          fixtureTimestamp(a)
      );

  live =
    live
      .filter(
        (fixture) => {
          const status =
            String(
              fixture?.status ??
              ""
            )
              .trim()
              .toLowerCase();

          return (
            status !==
              "finished" &&
            status !==
              "cancelled" &&
            status !==
              "postponed" &&
            status !==
              "unresolved"
          );
        }
      )
      .sort(
        (a, b) =>
          fixtureTimestamp(a) -
          fixtureTimestamp(b)
      );

  upcoming =
    upcoming
      .filter(
        (fixture) =>
          fixtureTimestamp(
            fixture
          ) > now
      )
      .sort(
        (a, b) =>
          fixtureTimestamp(a) -
          fixtureTimestamp(b)
      );

  const resolvedLive =
    live[0]
      ? await resolveFixture(
          live[0]
        )
      : null;

  const last =
    finished[0]
      ? await resolveFixture(
          finished[0]
        )
      : null;

  const next =
    await Promise.all(
      upcoming
        .slice(
          0,
          6
        )
        .map(
          (fixture) =>
            resolveFixture(
              fixture
            )
        )
    );

  return {
    live:
      resolvedLive,

    last,

    next
  };
}
