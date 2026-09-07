import React from "react";
import { createRoot } from "react-dom/client";
import { createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import MediaCard from "../../../apps/web/src/components/MediaCard";
import "./style.css";
const before = new URLSearchParams(location.search).has("before");
const route = createRootRoute({component: () => <main style={{padding:24}}>
<h1>MediaCard performance fixture — {before ? "before" : "after"}</h1>
<div style={{display:"grid",gridTemplateColumns:"repeat(6, 180px)",gap:16}}>
{Array.from({length:120},(_,i)=><MediaCard key={i} id={i+1} title={`Fixture movie ${i+1}`} type="movie" posterUrl={`/poster.png?id=${i}`} imageLoading={before || i<6 ? "eager":"lazy"}/>)}</div></main>});
const router=createRouter({routeTree:route});
createRoot(document.getElementById("root")!).render(<RouterProvider router={router}/>);
