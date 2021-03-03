// @flow
import fractionalIndex from "fractional-index";
import { observer } from "mobx-react";
import * as React from "react";
import { useDrop, useDrag } from "react-dnd";
import styled from "styled-components";
import UiStore from "stores/UiStore";
import Collection from "models/Collection";
import Document from "models/Document";
import CollectionIcon from "components/CollectionIcon";
import DropToImport from "components/DropToImport";
import DocumentLink from "./DocumentLink";
import DropCursor from "./DropCursor";
import EditableTitle from "./EditableTitle";
import SidebarLink from "./SidebarLink";
import useStores from "hooks/useStores";
import CollectionMenu from "menus/CollectionMenu";
import CollectionSortMenu from "menus/CollectionSortMenu";

type Props = {|
  collection: Collection,
  ui: UiStore,
  canUpdate: boolean,
  activeDocument: ?Document,
  prefetchDocument: (id: string) => Promise<void>,
  belowCollectionIndex: string,
|};

function CollectionLink({
  collection,
  activeDocument,
  prefetchDocument,
  canUpdate,
  ui,
  belowCollectionIndex,
}: Props) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleTitleChange = React.useCallback(
    async (name: string) => {
      await collection.save({ name });
    },
    [collection]
  );

  const { documents, policies, collections } = useStores();
  const expanded = collection.id === ui.activeCollectionId;
  const manualSort = collection.sort.field === "index";
  const can = policies.abilities(collection.id);

  // Drop to re-parent
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: "document",
    drop: (item, monitor) => {
      if (monitor.didDrop()) return;
      if (!collection) return;
      documents.move(item.id, collection.id);
    },
    canDrop: (item, monitor) => {
      return policies.abilities(collection.id).update;
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });

  // Drop to reorder
  const [{ isOverReorder }, dropToReorder] = useDrop({
    accept: "document",
    drop: async (item, monitor) => {
      if (!collection) return;
      documents.move(item.id, collection.id, undefined, 0);
    },
    collect: (monitor) => ({
      isOverReorder: !!monitor.isOver(),
    }),
  });

  //Drop to reorder Collection
  const [{ isCollectionDropping }, dropToReorderCollection] = useDrop({
    accept: "collection",
    drop: async (item, monitor) => {
      collections.move(
        item.id,
        fractionalIndex(collection.index, belowCollectionIndex)
      );
    },
    collect: (monitor) => ({
      isCollectionDropping: monitor.isOver(),
    }),
  });

  // Drag to reorder Collection
  const [{ isCollectionDragging }, dragToReorderCollection] = useDrag({
    item: {
      type: "collection",
      activeCollectionId: ui.activeCollectionId,
      id: collection.id,
    },
    collect: (monitor) => ({
      isCollectionDragging: monitor.isDragging(),
    }),
    canDrag: (monitor) => {
      return policies.abilities(collection.id).move;
    },
    begin: (monitor) => {
      ui.activeCollectionId = "";
    },
    end: (monitor) => {
      ui.activeCollectionId = monitor.activeCollectionId;
    },
  });

  return (
    <>
      <div ref={drop} style={{ position: "relative" }}>
        <Draggable
          key={collection.id}
          ref={dragToReorderCollection}
          $isDragging={isCollectionDragging}
          $isMoving={isCollectionDragging}
        >
          <DropToImport key={collection.id} collectionId={collection.id}>
            <SidebarLinkWithPadding
              key={collection.id}
              to={collection.url}
              icon={
                <CollectionIcon collection={collection} expanded={expanded} />
              }
              iconColor={collection.color}
              expanded={expanded}
              showActions={menuOpen || expanded}
              isActiveDrop={isOver && canDrop}
              label={
                <EditableTitle
                  title={collection.name}
                  onSubmit={handleTitleChange}
                  canUpdate={canUpdate}
                />
              }
              exact={false}
              menu={
                <>
                  {can.update && (
                    <CollectionSortMenuWithMargin
                      collection={collection}
                      onOpen={() => setMenuOpen(true)}
                      onClose={() => setMenuOpen(false)}
                    />
                  )}
                  <CollectionMenu
                    collection={collection}
                    onOpen={() => setMenuOpen(true)}
                    onClose={() => setMenuOpen(false)}
                  />
                </>
              }
            />
          </DropToImport>
        </Draggable>
        {expanded && manualSort && (
          <DropCursor isActiveDrop={isOverReorder} innerRef={dropToReorder} />
        )}
        {!expanded && (
          <DropCursor
            isActiveDrop={isCollectionDropping}
            innerRef={dropToReorderCollection}
          />
        )}
      </div>

      {expanded &&
        collection.documents.map((node, index) => (
          <DocumentLink
            key={node.id}
            node={node}
            collection={collection}
            activeDocument={activeDocument}
            prefetchDocument={prefetchDocument}
            canUpdate={canUpdate}
            depth={1.5}
            index={index}
          />
        ))}
    </>
  );
}

const Draggable = styled("div")`
  opacity: ${(props) => (props.$isDragging || props.$isMoving ? 0.5 : 1)};
  pointer-events: ${(props) => (props.$isMoving ? "none" : "all")};
`;

const SidebarLinkWithPadding = styled(SidebarLink)`
  padding-right: 60px;
`;

const CollectionSortMenuWithMargin = styled(CollectionSortMenu)`
  margin-right: 4px;
`;

export default observer(CollectionLink);
